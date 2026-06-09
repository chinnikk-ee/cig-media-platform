import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Heart, MessageCircle, Download, Bookmark, Share2, Tag, Send, Trash2,
  AlertTriangle, X, ChevronLeft, ChevronRight, ChevronUp, Play
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function DeleteConfirmModal({ onConfirm, onCancel, deleting }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Delete media?</h3>
              <p className="text-sm text-slate-500 mt-0.5">This action cannot be undone.</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-slate-900 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 btn bg-dark-700 hover:bg-dark-600 text-slate-600 py-2 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 btn bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MediaDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { joinMedia, leaveMedia } = useSocket();
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filmstrip / navigation across the event's media
  const [eventMedia, setEventMedia] = useState([]);
  const fetchedEventRef = useRef(null);
  const filmstripRef = useRef(null);
  const activeThumbRef = useRef(null);

  // Mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Swipe tracking
  const touchStartX = useRef(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/media/${id}`).then(res => setMedia(res.data.media)).catch(() => toast.error('Failed to load media')).finally(() => setLoading(false));
    joinMedia(id);
    setDrawerOpen(false);
    return () => leaveMedia(id);
  }, [id]);

  // Fetch the event's media list once per event for the filmstrip + prev/next nav
  useEffect(() => {
    const eventId = media?.event_id;
    if (!eventId || fetchedEventRef.current === eventId) return;
    fetchedEventRef.current = eventId;
    api.get(`/events/${eventId}/media`, { params: { page: 1, limit: 100 } })
      .then(res => setEventMedia(res.data.media || []))
      .catch(() => setEventMedia([]));
  }, [media?.event_id]);

  // Navigation neighbours
  const currentIndex = eventMedia.findIndex(m => String(m.id) === String(id));
  const prevMedia = currentIndex > 0 ? eventMedia[currentIndex - 1] : null;
  const nextMedia = currentIndex >= 0 && currentIndex < eventMedia.length - 1 ? eventMedia[currentIndex + 1] : null;

  const goTo = (mid) => { if (mid) navigate(`/media/${mid}`); };
  const goPrev = () => goTo(prevMedia?.id);
  const goNext = () => goTo(nextMedia?.id);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (showDeleteModal) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') navigate(media?.event_id ? `/events/${media.event_id}` : '/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevMedia, nextMedia, showDeleteModal, media?.event_id]);

  // Keep the active filmstrip thumbnail in view
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [id, eventMedia.length]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) { dx > 0 ? goPrev() : goNext(); }
    touchStartX.current = null;
  };

  const handleLike = async () => {
    if (!user) return toast.error('Login to like');
    try {
      const res = await api.post('/social/like', { media_id: id });
      setMedia(m => ({ ...m, is_liked: res.data.liked, like_count: res.data.like_count }));
    } catch { toast.error('Failed to like'); }
  };

  const handleFav = async () => {
    if (!user) return toast.error('Login to favourite');
    try {
      const res = await api.post('/social/favourite', { media_id: id });
      setMedia(m => ({ ...m, is_favourited: res.data.favourited }));
      toast.success(res.data.favourited ? 'Added to favourites' : 'Removed');
    } catch { toast.error('Failed to update favourites'); }
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(`/media/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `cig-${media.file_name || id}.jpg`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await api.delete(`/media/${id}`);
      toast.success('Media deleted');
      navigate(media.event_id ? `/events/${media.event_id}` : '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete media');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied!');
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/social/comment', { media_id: id, content: comment });
      setMedia(m => ({ ...m, comments: [...(m.comments || []), res.data.comment] }));
      setComment('');
    } catch { toast.error('Failed to comment'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/social/comment/${commentId}`);
      setMedia(m => ({ ...m, comments: m.comments.filter(c => c.id !== commentId) }));
    } catch { toast.error('Failed to delete comment'); }
  };

  const searchUsers = async (q) => {
    if (!q) return setTagResults([]);
    const res = await api.get('/users/search', { params: { q } });
    setTagResults(res.data.users || []);
  };

  const handleTag = async (taggedUserId) => {
    try {
      await api.post('/social/tag', { media_id: id, tagged_user_id: taggedUserId });
      toast.success('User tagged!');
      setTagSearch(''); setTagResults([]);
      const res = await api.get(`/media/${id}`);
      setMedia(res.data.media);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to tag');
    }
  };

  if (loading) return (
    <div className="lg:h-[calc(100vh-7rem)] lg:flex lg:gap-4">
      <div className="flex-1 skeleton-card min-h-[50vh] lg:min-h-0" />
      <div className="lg:w-[380px] lg:flex-shrink-0 space-y-3 mt-4 lg:mt-0">
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton-card h-40" />
        <div className="skeleton-card h-64" />
      </div>
    </div>
  );
  if (!media) return <div className="text-center py-20 text-gray-500">Media not found</div>;

  const canDelete = user && (user.id === media.uploaded_by || user.role === 'admin');
  const initial = (s) => (s ? s[0].toUpperCase() : '?');

  // ── Action icon row (Like · Comment · Bookmark · Download · Share · Tag) ──
  const actionRow = (
    <div className="flex items-center gap-1 border-b border-dark-600 px-2 py-2.5">
      <button onClick={handleLike}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all hover:bg-dark-700 ${media.is_liked ? 'text-red-400' : 'text-slate-600 hover:text-red-400'}`}>
        <Heart size={18} fill={media.is_liked ? 'currentColor' : 'none'} strokeWidth={media.is_liked ? 0 : 1.75} />
        <span>{media.like_count || 0}</span>
      </button>
      <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-500">
        <MessageCircle size={18} strokeWidth={1.75} /> {media.comments?.length || 0}
      </span>
      <div className="flex-1" />
      <button onClick={handleFav} title="Favourite"
        className={`icon-btn ${media.is_favourited ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400'}`}>
        <Bookmark size={18} fill={media.is_favourited ? 'currentColor' : 'none'} strokeWidth={media.is_favourited ? 0 : 1.75} />
      </button>
      <button onClick={handleDownload} title="Download" className="icon-btn"><Download size={18} strokeWidth={1.75} /></button>
      <button onClick={handleShare} title="Share" className="icon-btn"><Share2 size={18} strokeWidth={1.75} /></button>
      {canDelete && (
        <button onClick={() => setShowDeleteModal(true)} title="Delete" className="icon-btn hover:text-red-400"><Trash2 size={18} strokeWidth={1.75} /></button>
      )}
    </div>
  );

  // ── Scrollable info content (metadata, AI tags, tagged people, comments) ──
  const infoBody = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
      {/* Metadata */}
      <div>
        <Link to={`/events/${media.event_id}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
          {media.event_name || 'Event'}
        </Link>
        <p className="text-sm text-slate-500 mt-1">By <span className="text-slate-800">{media.uploader_name}</span></p>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatDistanceToNow(new Date(media.created_at), { addSuffix: true })}
        </p>
        {media.caption && <p className="text-sm text-slate-600 mt-3 italic">"{media.caption}"</p>}
      </div>

      {/* AI tags */}
      {media.ai_tags?.length > 0 && (
        <div>
          <p className="section-label mb-2">AI Tags</p>
          <div className="flex flex-wrap gap-2">
            {media.ai_tags.map(tag => (
              <Link key={tag} to={`/search?tags=${tag}`}
                className="badge bg-dark-700 text-slate-600 hover:bg-primary-600/20 hover:text-primary-600 transition-all cursor-pointer">
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tagged people */}
      {media.tags?.length > 0 && (
        <div>
          <p className="section-label mb-2 flex items-center gap-1"><Tag size={11} /> Tagged people</p>
          <div className="flex flex-wrap gap-2">
            {media.tags.map(t => (
              <span key={t.id} className="flex items-center gap-1.5 badge bg-dark-700 text-slate-600 pl-1 pr-2.5 py-1">
                <span className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center text-[10px] text-white">{initial(t.tagged_user?.username)}</span>
                @{t.tagged_user?.username}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tag a user */}
      {user && (
        <div>
          <p className="section-label mb-2 flex items-center gap-1"><Tag size={11} /> Tag someone</p>
          <div className="relative">
            <input value={tagSearch} onChange={e => { setTagSearch(e.target.value); searchUsers(e.target.value); }}
              className="input text-sm" placeholder="Search username..." />
            {tagResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 card z-20 overflow-hidden">
                {tagResults.map(u => (
                  <button key={u.id} onClick={() => handleTag(u.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-700 text-left">
                    <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs text-white">{initial(u.username)}</div>
                    <span className="text-sm">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      <div>
        <p className="section-label mb-3">Comments ({media.comments?.length || 0})</p>
        <div className="space-y-3">
          {media.comments?.map(c => (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs flex-shrink-0 text-white">
                {initial(c.users?.username)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-primary-600">@{c.users?.username} </span>
                <span className="text-sm text-slate-600">{c.content}</span>
                <p className="text-xs text-gray-600 mt-0.5">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
              </div>
              {user && (user.id === c.user_id || user.role === 'admin') && (
                <button onClick={() => handleDeleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {(!media.comments || media.comments.length === 0) && (
            <p className="text-gray-500 text-sm text-center py-4">No comments yet</p>
          )}
        </div>
      </div>
    </div>
  );

  const commentForm = user && (
    <form onSubmit={handleComment} className="flex gap-2 border-t border-dark-600 p-3">
      <input value={comment} onChange={e => setComment(e.target.value)}
        className="input text-sm flex-1" placeholder="Write a comment..." />
      <button type="submit" disabled={submitting || !comment.trim()} className="btn-primary px-3 py-2">
        <Send size={16} />
      </button>
    </form>
  );

  return (
    <div className="lg:h-[calc(100vh-7rem)] lg:flex lg:gap-4">
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      {/* ── Image pane ──────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col card overflow-hidden min-h-0">
        {/* Top bar: breadcrumb + close */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2.5 bg-gradient-to-b from-black/70 to-transparent">
          <Link to={`/events/${media.event_id}`} className="flex items-center gap-1.5 text-sm text-gray-200 hover:text-white transition-colors max-w-[70%] truncate">
            <span className="truncate">{media.event_name || 'Event'}</span>
          </Link>
          {currentIndex >= 0 && (
            <span className="hidden sm:block text-xs text-gray-200">{currentIndex + 1} / {eventMedia.length}</span>
          )}
          <button onClick={() => navigate(media.event_id ? `/events/${media.event_id}` : '/')}
            className="icon-btn text-gray-200 hover:text-white bg-black/30" title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Image / video */}
        <div
          className="relative flex-1 flex items-center justify-center bg-dark-900 min-h-[45vh] lg:min-h-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {media.media_type === 'video' ? (
            <video src={media.url} controls className="max-h-full max-w-full" />
          ) : (
            <img src={media.url} alt={media.file_name} className="max-h-full max-w-full object-contain" />
          )}

          {/* Prev / Next arrows */}
          {prevMedia && (
            <button onClick={goPrev} title="Previous (←)"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors">
              <ChevronLeft size={22} />
            </button>
          )}
          {nextMedia && (
            <button onClick={goNext} title="Next (→)"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors">
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        {/* Filmstrip */}
        {eventMedia.length > 1 && (
          <div ref={filmstripRef} className="flex gap-1.5 overflow-x-auto px-2 py-2 bg-dark-800/80 border-t border-dark-600">
            {eventMedia.map(m => {
              const active = String(m.id) === String(id);
              return (
                <button key={m.id} ref={active ? activeThumbRef : null} onClick={() => goTo(m.id)}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden transition-all ${active ? 'ring-2 ring-primary-500' : 'opacity-55 hover:opacity-100'}`}>
                  <img src={m.thumbnail_url || m.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {m.media_type === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play size={14} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile: open details drawer */}
        <button onClick={() => setDrawerOpen(true)}
          className="lg:hidden flex items-center justify-center gap-1.5 text-sm text-slate-600 bg-dark-800 border-t border-dark-600 py-2.5">
          <ChevronUp size={16} /> Details & comments
        </button>
      </div>

      {/* ── Info pane (desktop) ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[380px] lg:flex-shrink-0 flex-col card min-h-0">
        {actionRow}
        {infoBody}
        {commentForm}
      </div>

      {/* ── Info drawer (mobile) ────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[150] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative card rounded-b-none flex flex-col max-h-[85vh] animate-slide-up">
            <div className="flex justify-center pt-2.5 pb-1" onClick={() => setDrawerOpen(false)}>
              <div className="w-10 h-1 rounded-full bg-dark-500" />
            </div>
            {actionRow}
            {infoBody}
            {commentForm}
          </div>
        </div>
      )}
    </div>
  );
}
