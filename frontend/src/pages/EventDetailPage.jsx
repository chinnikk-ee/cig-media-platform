import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MediaCard from '../components/MediaCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Camera, Calendar, MapPin, Lock, QrCode, Upload, ArrowLeft, Trash2, AlertTriangle, X, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

// Rendered via a Portal so it always sits above every stacking context in the layout
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

  // Delete event modal
  const [showDeleteEvent, setShowDeleteEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Multi-select delete
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showDeleteMedia, setShowDeleteMedia] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/events/${id}`;
    QRCode.toDataURL(url, { width: 320, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [id]);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event)).catch(() => toast.error('Event not found'));
    joinEvent(id);
    return () => leaveEvent(id);
  }, [id]);

  const loadMedia = async () => {
    if (loadingRef.current) return;          // guard against concurrent/duplicate fetches
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
    if (selected.size === media.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(media.map(m => m.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleDeleteSelectedMedia = async () => {
    setDeletingMedia(true);
    const ids = [...selected];
    try {
      const results = await Promise.allSettled(ids.map(mid => api.delete(`/media/${mid}`)));
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = ids.length - failed;
      const deletedIds = new Set(
        ids.filter((_, i) => results[i].status === 'fulfilled')
      );
      setMedia(prev => prev.filter(m => !deletedIds.has(m.id)));
      if (failed === 0) toast.success(`${succeeded} item${succeeded !== 1 ? 's' : ''} deleted`);
      else toast.error(`${succeeded} deleted, ${failed} failed — check permissions`);
    } catch (err) {
      toast.error('Delete failed — please try again');
    } finally {
      setSelected(new Set());
      setSelectMode(false);
      setDeletingMedia(false);
      setShowDeleteMedia(false);
    }
  };

  if (loading && !event) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
    </div>
  );

  if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

  const canModifyEvent = user && (user.role === 'admin' || event.created_by === user.id);
  const canDeleteMedia = user && ['admin', 'photographer'].includes(user.role);

  return (
    <div className="space-y-6">
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

      {/* Back */}
      <Link to="/events" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all text-sm">
        <ArrowLeft size={16} /> Back to Events
      </Link>

      {/* Header */}
      <div className="card overflow-hidden">
        {event.cover_image && (
          <div className="aspect-[3/1] overflow-hidden">
            <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{event.name}</h1>
                {!event.is_public && <span className="badge bg-yellow-500/20 text-yellow-400 flex items-center gap-1"><Lock size={10} /> Private</span>}
                {event.category && <span className="badge bg-primary-600/20 text-primary-400">{event.category}</span>}
              </div>
              {event.description && <p className="text-gray-400 mt-2">{event.description}</p>}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                {event.event_date && <span className="flex items-center gap-1"><Calendar size={14} />{format(new Date(event.event_date), 'MMMM d, yyyy')}</span>}
                {event.location && <span className="flex items-center gap-1"><MapPin size={14} />{event.location}</span>}
                <span className="flex items-center gap-1">
                  <Camera size={14} />
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
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={handleShare} className="btn-secondary text-sm">Share</button>
              {qrDataUrl && (
                <button onClick={() => setShowQR(!showQR)} className="btn-secondary text-sm">
                  <QrCode size={16} /> QR Code
                </button>
              )}
              {user && ['admin', 'photographer', 'member'].includes(user.role) && (
                <Link to={`/upload?event=${id}`} className="btn-primary text-sm">
                  <Upload size={16} /> Upload
                </Link>
              )}
              {canModifyEvent && (
                <button
                  onClick={() => setShowDeleteEvent(true)}
                  className="px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  <Trash2 size={16} /> Delete Event
                </button>
              )}
            </div>
          </div>

          {/* QR Code */}
          {showQR && qrDataUrl && (
            <div className="mt-4 p-4 bg-white rounded-xl inline-block">
              <img src={qrDataUrl} alt="QR Code" className="w-40 h-40" />
              <p className="text-dark-900 text-xs text-center mt-2 font-medium">Scan to open album</p>
            </div>
          )}
        </div>
      </div>

      {/* Media gallery */}
      {media.length === 0 && !loading ? (
        <div className="text-center py-20 text-gray-500">
          <Camera size={40} className="mx-auto mb-3 opacity-30" />
          <p>No media yet</p>
          {user && ['admin', 'photographer', 'member'].includes(user.role) && (
            <Link to="/upload" className="btn-primary mt-4 inline-flex">Upload first photo or video</Link>
          )}
        </div>
      ) : (
        <>
          {/* Gallery toolbar */}
          {canDeleteMedia && media.length > 0 && (
            <div className="flex items-center justify-between">
              {selectMode ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={toggleSelectAll} className="btn-secondary text-sm flex items-center gap-2">
                    <CheckSquare size={15} />
                    {selected.size === media.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <span className="text-sm text-gray-400">
                    {selected.size} selected
                  </span>
                  {selected.size > 0 && (
                    <button
                      onClick={() => setShowDeleteMedia(true)}
                      className="btn bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={14} /> Delete {selected.size}
                    </button>
                  )}
                  <button onClick={exitSelectMode} className="text-sm text-gray-500 hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectMode(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <CheckSquare size={15} /> Select
                </button>
              )}
            </div>
          )}

          <InfiniteScroll
            dataLength={media.length}
            next={loadMedia}
            hasMore={hasMore}
            loader={<div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>}
            endMessage={<p className="text-center text-gray-600 py-6 text-sm">All media loaded</p>}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map(m => (
                <MediaCard
                  key={m.id}
                  media={m}
                  selectable={selectMode}
                  selected={selected.has(m.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          </InfiniteScroll>
        </>
      )}
    </div>
  );
}