import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';
import { X, Heart, MessageCircle, Tag, Upload, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ICON_MAP   = { like: Heart, comment: MessageCircle, tag: Tag, upload: Upload };
const TYPE_COLOR = {
  like:    'text-red-400 bg-red-400/10',
  comment: 'text-blue-400 bg-blue-400/10',
  tag:     'text-yellow-400 bg-yellow-400/10',
  upload:  'text-green-400 bg-green-400/10',
};

export default function NotificationPanel({ onClose, mobile = false }) {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const { notifications, markAllRead } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications')
      .then(res => setNotifs(res.data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    markAllRead();
    api.post('/notifications/mark-read', { ids: [] }).catch(() => {});
  }, []);

  // Merge real-time + fetched, deduplicate by id
  const all = [...notifications, ...notifs]
    .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const handleClick = (n) => {
    if (n.media_id)      navigate(`/media/${n.media_id}`);
    else if (n.event_id) navigate(`/events/${n.event_id}`);
    onClose();
  };

  const containerClass = mobile
    ? 'bg-dark-800 border-t border-dark-600 rounded-t-[20px] w-full'
    : 'bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl w-80';

  return (
    <div className={containerClass} style={mobile ? {} : { height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Handle (mobile only) */}
      {mobile && <div className="w-10 h-1 bg-dark-500 rounded-full mx-auto mt-3 mb-1" />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-primary-400" />
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        <button onClick={onClose} className="icon-btn" aria-label="Close notifications">
          <X size={16} />
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1" style={mobile ? { maxHeight: '60vh' } : {}}>
        {loading ? (
          /* Skeleton */
          <div className="p-3 space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-start gap-3 p-2">
                <div className="skeleton-round w-8 h-8 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton-text w-full" />
                  <div className="skeleton-text w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Bell size={32} className="text-dark-500 mb-3" />
            <p className="text-sm font-medium text-gray-400">All caught up</p>
            <p className="text-xs text-gray-600 mt-1">No notifications yet</p>
          </div>
        ) : (
          all.map(n => {
            const Icon     = ICON_MAP[n.type] || Upload;
            const colors   = TYPE_COLOR[n.type] || 'text-primary-400 bg-primary-400/10';
            const isUnread = !n.is_read;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`
                  w-full flex items-start gap-3 px-4 py-3 text-left
                  border-b border-dark-700 last:border-0
                  transition-all duration-150 hover:bg-dark-700
                  ${isUnread ? 'bg-primary-600/5' : ''}
                `}
              >
                {/* Icon badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colors}`}>
                  <Icon size={14} />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 leading-snug">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {/* Unread dot */}
                {isUnread && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: 'var(--color-primary-500)' }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
