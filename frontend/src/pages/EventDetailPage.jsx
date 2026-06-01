import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MediaCard from '../components/MediaCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Camera, Calendar, MapPin, Lock, QrCode, Upload, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { joinEvent, leaveEvent } = useSocket();
  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event)).catch(() => toast.error('Event not found'));
    joinEvent(id);
    return () => leaveEvent(id);
  }, [id]);

  const loadMedia = async () => {
    try {
      const res = await api.get(`/events/${id}/media`, { params: { page, limit: 20 } });
      const newMedia = res.data.media || [];
      setMedia(prev => page === 1 ? newMedia : [...prev, ...newMedia]);
      setHasMore(newMedia.length === 20);
      setPage(p => p + 1);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (id) loadMedia(); }, [id]);

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  if (loading && !event) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
    </div>
  );

  if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

  return (
    <div className="space-y-6">
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
                <span className="flex items-center gap-1"><Camera size={14} />{event.media_count || 0} photos</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleShare} className="btn-secondary text-sm">Share</button>
              {event.qr_code && (
                <button onClick={() => setShowQR(!showQR)} className="btn-secondary text-sm">
                  <QrCode size={16} /> QR Code
                </button>
              )}
              {user && ['admin','photographer','member'].includes(user.role) && (
                <Link to={`/upload?event=${id}`} className="btn-primary text-sm">
                  <Upload size={16} /> Upload
                </Link>
              )}
            </div>
          </div>

          {/* QR Code modal */}
          {showQR && event.qr_code && (
            <div className="mt-4 p-4 bg-white rounded-xl inline-block">
              <img src={event.qr_code} alt="QR Code" className="w-40 h-40" />
              <p className="text-dark-900 text-xs text-center mt-2 font-medium">Scan to open album</p>
            </div>
          )}
        </div>
      </div>

      {/* Media gallery with infinite scroll */}
      {media.length === 0 && !loading ? (
        <div className="text-center py-20 text-gray-500">
          <Camera size={40} className="mx-auto mb-3 opacity-30" />
          <p>No photos yet</p>
          {user && ['admin','photographer','member'].includes(user.role) && (
            <Link to="/upload" className="btn-primary mt-4 inline-flex">Upload first photo</Link>
          )}
        </div>
      ) : (
        <InfiniteScroll
          dataLength={media.length}
          next={loadMedia}
          hasMore={hasMore}
          loader={<div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>}
          endMessage={<p className="text-center text-gray-600 py-6 text-sm">All photos loaded</p>}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map(m => <MediaCard key={m.id} media={m} />)}
          </div>
        </InfiniteScroll>
      )}
    </div>
  );
}
