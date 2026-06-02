import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', { withCredentials: true });
    setSocket(socketRef.current);

    if (user) {
      socketRef.current.emit('user:online', user.id);
      socketRef.current.emit('notifications:join', user.id);

      socketRef.current.on('notification:new', (notif) => {
        setNotifications(prev => [notif, ...prev].slice(0, 50));
        setUnreadCount(c => c + 1);
      });
    }

    return () => { socketRef.current?.disconnect(); setSocket(null); };
  }, [user?.id]);

  const joinEvent = (eventId) => socketRef.current?.emit('event:join', eventId);
  const leaveEvent = (eventId) => socketRef.current?.emit('event:leave', eventId);
  const joinMedia = (mediaId) => socketRef.current?.emit('media:join', mediaId);
  const leaveMedia = (mediaId) => socketRef.current?.emit('media:leave', mediaId);

  const markAllRead = () => setUnreadCount(0);

  return (
    <SocketContext.Provider value={{
      socket,
      notifications, unreadCount, markAllRead,
      joinEvent, leaveEvent, joinMedia, leaveMedia,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
