import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MediaCard from '../components/MediaCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Camera, Calendar, MapPin, Lock, QrCode, Upload, ArrowLeft,
  Trash2, AlertTriangle, X, CheckSquare, Grid, LayoutTemplate,
  Share2, Hash, ScanFace
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

function DeleteConfirmModal({ title, description, onConfirm, onCancel, deleting }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-gray-400 mt-0.5">{description}</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={deleting} className="text-gray-500 hover:text-white transition-colors">
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
            {deleting
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MediaGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-dark-700 animate-pulse" />
      ))}
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinEvent, leaveEvent } = useSocket();
  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [gridMode, setGridMode] = useState('square');
  const [activeTag, setActiveTag] = useState(null);
  const [isSticky, setIsSticky] = useState(false);
  const subheaderRef = useRef(null);

  const [showDeleteEvent, setShowDeleteEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showDeleteMedia, setShowDeleteMedia] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/events/${id}`;
    QRCode.toDataURL(url, { width: 320, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [id]);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event)).catch(() => toast.error('Event not found'));
    joinEvent(id);
    return () => leaveEvent(id);
  }, [id]);

  const loadMedia = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const pageToLoad = pageRef.current;
    try {
      const res = await api.get(`/events/${id}/media`, { params: { page: pageToLoad, limit: 20 } });
      const newMedia = res.data.media || [];
      setMedia(prev => pageToLoad === 1 ? newMedia : [...prev, ...newMedia]);
      setHasMore(newMedia.length === 20);
      pageRef.current = pageToLoad + 1;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!id) return;
    pageRef.current = 1;
    loadingRef.current = false;
    setMedia([]);
    setHasMore(true);
    setLoading(true);
    loadMedia();
  }, [id]);

  // Sticky sub-header detection
  useEffect(() => {
    const el = subheaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(!e.isIntersecting),
      { threshold: 1, rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [event]);

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const handleDeleteEvent = async () => {
    setDeletingEvent(true);
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted');
      navigate('/events');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete event');
      setDeletingEvent(false);
      setShowDeleteEvent(false);
    }
  };

  const toggleSelect = (mediaId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(mediaId) ? next.delete(mediaId) : next.add(mediaId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(selected.size === media.length ? new Set() : new Set(media.map(m => m.id)));
  };

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const handleDeleteSelectedMedia = async () => {
    setDeletingMedia(true);
    const ids = [...selected];
    try {
      const results = await Promise.allSettled(ids.map(mid => api.delete(`/media/${mid}`)));
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = ids.length - failed;
      const deletedIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
      setMedia(prev => prev.filter(m => !deletedIds.has(m.id)));
      if (failed === 0) toast.success(`${succeeded} item${succeeded !== 1 ? 's' : ''} deleted`);
      else toast.error(`${succeeded} deleted, ${failed} failed — check permissions`);
    } catch {
      toast.error('Delete failed — please try again');
    } finally {
      setSelected(new Set());
      setSelectMode(false);
      setDeletingMedia(false);
      setShowDeleteMedia(false);
    }
  };

  // Collect unique AI tags from loaded media
  const allTags = [...new Set(media.flatMap(m => m.ai_tags || []))].slice(0, 12);
  const displayMedia = activeTag ? media.filter(m => m.ai_tags?.includes(activeTag)) : media;

  if (loading && !event) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
    </div>
  );

  if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

  const canModifyEvent = user && (user.role === 'admin' || event.created_by === user.id);
  const canDeleteMedia = user && ['admin', 'photographer'].includes(user.role);

  return (
    <div className="space-y-0 -mx-4 md:-mx-6">
      {showDeleteEvent && (
        <DeleteConfirmModal
          title="Delete this event?"
          description="All media in this event will also be deleted. This cannot be undone."
          onConfirm={handleDeleteEvent}
          onCancel={() => setShowDeleteEvent(false)}
          deleting={deletingEvent}
        />
      )}
      {showDeleteMedia && (
        <DeleteConfirmModal
          title={`Delete ${selected.size} item${selected.size !== 1 ? 's' : ''}?`}
          description="Selected media will be permanently removed. This cannot be undone."
          onConfirm={handleDeleteSelectedMedia}
          onCancel={() => setShowDeleteMedia(false)}
          deleting={deletingMedia}
        />
      )}

      {/* ── Full-bleed hero banner ── */}
      <div className="relative w-full overflow-hidden" style={{ height: 280 }}>
        {event.cover_image ? (
          <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-dark-700 flex items-center justify-center">
            <Camera size={48} className="text-dark-500" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,12,14,0.95) 0%, rgba(12,12,14,0.4) 50%, rgba(12,12,14,0.15) 100%)' }} />
        {/* Back button */}
        <Link to="/events"
          className="absolute top-4 left-4 md:left-6 inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <ArrowLeft size={14} /> Events
        </Link>
        {/* Event info */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-6 pb-5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {!event.is_public && (
              <span className="flex items-center gap-1 text-xs font-medium text-yellow-300 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
                <Lock size={10} /> Private
              </span>
            )}
            {event.category && (
              <span className="text-xs font-medium text-primary-300 px-2 py-0.5 rounded-full bg-primary-600/30 backdrop-blur-sm">
                {event.category}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{event.name}</h1>
          <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-white/60">
            {event.event_date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />{format(new Date(event.event_date), 'MMMM d, yyyy')}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />{event.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky sub-header ── */}
      <div
        ref={subheaderRef}
        className={`sticky top-0 z-20 transition-all duration-200 ${isSticky ? 'bg-dark-900/95 backdrop-blur-md border-b border-dark-700 shadow-lg' : 'bg-dark-900/80'}`}
      >
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-sm text-gray-400 min-w-0">
            <span className="font-semibold text-white truncate">{event.name}</span>
            <span className="flex items-center gap-1">
              <Camera size={12} />
              {(() => {
                const photos = event.photo_count || 0;
                const videos = event.video_count || 0;
                const total = event.media_count || 0;
                if (photos > 0 && videos > 0) return `${total} photos & videos`;
                if (videos > 0) return `${total} videos`;
                return `${total} photos`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleShare} className="btn-secondary text-xs py-1.5 gap-1.5">
              <Share2 size={13} /> Share
            </button>
            {qrDataUrl && (
              <button onClick={() => setShowQR(!showQR)} className="btn-secondary text-xs py-1.5 gap-1.5">
                <QrCode size={13} /> QR
              </button>
            )}
            {user && ['admin', 'photographer', 'member'].includes(user.role) && (
              <Link to={`/upload?event=${id}`} className="btn-primary text-xs py-1.5 gap-1.5">
                <Upload size={13} /> Upload
              </Link>
            )}
            {canModifyEvent && (
              <button onClick={() => setShowDeleteEvent(true)}
                className="px-2.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
        {showQR && qrDataUrl && (
          <div className="px-4 md:px-6 pb-3">
            <div className="inline-block p-3 bg-white rounded-xl">
              <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
              <p className="text-dark-900 text-xs text-center mt-1.5 font-medium">Scan to open album</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="px-4 md:px-6 pt-5 pb-10 space-y-5">
        {event.description && (
          <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">{event.description}</p>
        )}

        {/* AI tag chip rail */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Hash size={11} /> Tags
            </span>
            <button onClick={() => setActiveTag(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!activeTag ? 'bg-primary-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}>
              All
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600 border border-dark-600'}`}>
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Gallery toolbar */}
        {(media.length > 0 || !loading) && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Link to={`/my-photos?event=${id}`} className="btn-secondary text-xs py-1.5 gap-1.5 hidden sm:inline-flex">
                <ScanFace size={13} /> Find me
              </Link>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {/* Multi-select controls */}
              {canDeleteMedia && media.length > 0 && (
                selectMode ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={toggleSelectAll} className="btn-secondary text-xs py-1.5 gap-1.5">
                      <CheckSquare size={13} />
                      {selected.size === media.length ? 'Deselect all' : 'Select all'}
                    </button>
                    {selected.size > 0 && (
                      <button onClick={() => setShowDeleteMedia(true)}
                        className="text-xs px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-1.5 transition-colors">
                        <Trash2 size={12} /> Delete {selected.size}
                      </button>
                    )}
                    <span className="text-xs text-gray-500">{selected.size} selected</span>
                    <button onClick={exitSelectMode} className="text-xs text-gray-500 hover:text-white transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setSelectMode(true)} className="btn-secondary text-xs py-1.5 gap-1.5">
                    <CheckSquare size={13} /> Select
                  </button>
                )
              )}
              {/* Grid mode toggle */}
              <div className="flex border border-dark-600 rounded-lg overflow-hidden bg-dark-800">
                <button onClick={() => setGridMode('square')}
                  className={`px-2.5 py-1.5 transition-colors ${gridMode === 'square' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-white'}`} title="Square grid">
                  <Grid size={14} />
                </button>
                <button onClick={() => setGridMode('justified')}
                  className={`px-2.5 py-1.5 transition-colors ${gridMode === 'justified' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-white'}`} title="Justified grid">
                  <LayoutTemplate size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {displayMedia.length === 0 && !loading ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
              <Camera size={28} className="text-dark-500" />
            </div>
            <p className="text-gray-400 font-medium">
              {activeTag ? `No photos tagged #${activeTag}` : 'No media yet'}
            </p>
            {activeTag ? (
              <button onClick={() => setActiveTag(null)} className="btn-secondary text-sm mt-4">Show all</button>
            ) : user && ['admin', 'photographer', 'member'].includes(user.role) && (
              <Link to={`/upload?event=${id}`} className="btn-primary mt-4 text-sm">Upload first photo</Link>
            )}
          </div>
        ) : loading && media.length === 0 ? (
          <MediaGridSkeleton />
        ) : (
          <InfiniteScroll
            dataLength={displayMedia.length}
            next={loadMedia}
            hasMore={hasMore && !activeTag}
            loader={
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
              </div>
            }
            endMessage={
              displayMedia.length > 0 && (
                <p className="text-center text-gray-600 py-6 text-xs">All media loaded · {displayMedia.length} items</p>
              )
            }
          >
            {gridMode === 'square' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayMedia.map(m => (
                  <MediaCard key={m.id} media={m}
                    selectable={selectMode} selected={selected.has(m.id)} onSelect={toggleSelect} />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5" style={{ '--row-height': '220px' }}>
                {displayMedia.map(m => {
                  const ratio = (m.width && m.height) ? m.width / m.height : 1.5;
                  return (
                    <div key={m.id}
                      className="relative overflow-hidden rounded-lg bg-dark-700 flex-grow"
                      style={{ height: 'var(--row-height)', flexBasis: `calc(var(--row-height) * ${ratio})`, minWidth: 120, maxWidth: 500 }}>
                      <MediaCard media={m} masonry
                        selectable={selectMode} selected={selected.has(m.id)} onSelect={toggleSelect} />
                    </div>
                  );
                })}
                <div className="flex-grow-[999]" style={{ minWidth: '60%', height: 0 }} />
              </div>
            )}
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
}