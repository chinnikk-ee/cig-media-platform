import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';
import { X, Heart, MessageCircle, Tag, Upload } from 'lucide-react';

const iconMap = { like: Heart, comment: MessageCircle, tag: Tag, upload: Upload };

export default function NotificationPanel({ onClose }) {
  const [notifs, setNotifs] = useState([]);
  const { notifications, markAllRead } = useSocket();

  useEffect(() => {
    api.get('/notifications').then(res => {
      setNotifs(res.data.notifications || []);
    }).catch(() => {});
    markAllRead();
    api.post('/notifications/mark-read', { ids: [] });
  }, []);

  // Merge real-time notifs with fetched
  const all = [...notifications, ...notifs].filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);

  return (
    <div className="absolute right-0 top-12 w-80 card shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-dark-600">
        <h3 className="font-semibold">Notifications</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {all.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">No notifications yet</p>
        ) : all.map(n => {
          const Icon = iconMap[n.type] || Upload;
          return (
            <div key={n.id} className={`flex items-start gap-3 p-4 border-b border-dark-700 hover:bg-dark-700 transition-all ${!n.is_read ? 'bg-primary-600/5' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{n.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
