import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Heart, MessageCircle, Download, Bookmark, Share2, Tag, ArrowLeft, Send, Trash2, AlertTriangle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function DeleteConfirmModal({ onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Delete media?</h3>
              <p className="text-sm text-gray-400 mt-0.5">This action cannot be undone.</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 btn bg-dark-700 hover:bg-dark-600 text-gray-300 py-2 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 btn bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
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

  useEffect(() => {
    api.get(`/media/${id}`).then(res => setMedia(res.data.media)).catch(() => toast.error('Failed to load media')).finally(() => setLoading(false));
    joinMedia(id);
    return () => leaveMedia(id);
  }, [id]);

  // Real-time comments
  useEffect(() => {
    // Handled by socket context if needed
  }, []);

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

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" /></div>;
  if (!media) return <div className="text-center py-20 text-gray-500">Media not found</div>;

  return (
    <div className="max-w-6xl mx-auto">
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      <Link to={`/events/${media.event_id}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6">
        <ArrowLeft size={16} /> Back to {media.event_name || 'Event'}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            {media.media_type === 'video' ? (
              <video src={media.url} controls className="w-full max-h-[70vh]" />
            ) : (
              <img src={media.url} alt={media.file_name} className="w-full max-h-[70vh] object-contain bg-dark-900" />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="flex items-center gap-4">
              <button onClick={handleLike}
                className={`flex items-center gap-2 text-sm transition-all ${media.is_liked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                <Heart size={20} fill={media.is_liked ? 'currentColor' : 'none'} />
                <span>{media.like_count || 0}</span>
              </button>
              <span className="flex items-center gap-2 text-gray-400 text-sm">
                <MessageCircle size={20} /> {media.comments?.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleFav} className={`transition-all ${media.is_favourited ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}>
                <Bookmark size={20} fill={media.is_favourited ? 'currentColor' : 'none'} />
              </button>
              <button onClick={handleShare} className="text-gray-400 hover:text-white"><Share2 size={20} /></button>
              <button onClick={handleDownload} className="text-gray-400 hover:text-white"><Download size={20} /></button>
              {user && (user.id === media.uploaded_by || user.role === 'admin') && (
                <button onClick={() => setShowDeleteModal(true)} className="text-gray-400 hover:text-red-400 transition-colors" title="Delete media">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Tags (AI) */}
          {media.ai_tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 px-2">
              {media.ai_tags.map(tag => (
                <Link key={tag} to={`/search?tags=${tag}`}
                  className="badge bg-dark-700 text-gray-300 hover:bg-primary-600/20 hover:text-primary-400 transition-all cursor-pointer">
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info */}
          <div className="card p-4">
            <h3 className="font-semibold mb-2">{media.event_name}</h3>
            <p className="text-sm text-gray-400">By <span className="text-white">{media.uploader_name}</span></p>
            <p className="text-xs text-gray-500 mt-1">
              {formatDistanceToNow(new Date(media.created_at), { addSuffix: true })}
            </p>
            {media.caption && <p className="text-sm text-gray-300 mt-3 italic">"{media.caption}"</p>}

            {/* Tagged users */}
            {media.tags?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Tag size={12} /> Tagged</p>
                <div className="flex flex-wrap gap-2">
                  {media.tags.map(t => (
                    <span key={t.id} className="badge bg-dark-700 text-gray-300">@{t.tagged_user?.username}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tag a user */}
          {user && (
            <div className="card p-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Tag size={14} /> Tag someone</h4>
              <div className="relative">
                <input value={tagSearch} onChange={e => { setTagSearch(e.target.value); searchUsers(e.target.value); }}
                  className="input text-sm" placeholder="Search username..." />
                {tagResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 card z-10">
                    {tagResults.map(u => (
                      <button key={u.id} onClick={() => handleTag(u.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-700 text-left">
                        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs">{u.username[0].toUpperCase()}</div>
                        <span className="text-sm">@{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card p-4">
            <h4 className="text-sm font-medium mb-3">Comments ({media.comments?.length || 0})</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {media.comments?.map(c => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs flex-shrink-0">
                    {c.users?.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary-400">@{c.users?.username} </span>
                    <span className="text-sm text-gray-300">{c.content}</span>
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

            {user && (
              <form onSubmit={handleComment} className="flex gap-2 mt-4">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  className="input text-sm flex-1" placeholder="Write a comment..." />
                <button type="submit" disabled={submitting || !comment.trim()} className="btn-primary px-3 py-2">
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}