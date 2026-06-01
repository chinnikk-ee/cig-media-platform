const setupSocket = (io) => {
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User comes online
    socket.on('user:online', (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      io.emit('users:online', Array.from(onlineUsers.keys()));
    });

    // Join event room (to get live upload notifications)
    socket.on('event:join', (eventId) => {
      socket.join(`event:${eventId}`);
    });

    socket.on('event:leave', (eventId) => {
      socket.leave(`event:${eventId}`);
    });

    // Join media room (for live comments)
    socket.on('media:join', (mediaId) => {
      socket.join(`media:${mediaId}`);
    });

    socket.on('media:leave', (mediaId) => {
      socket.leave(`media:${mediaId}`);
    });

    // Join personal notification room
    socket.on('notifications:join', (userId) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('users:online', Array.from(onlineUsers.keys()));
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupSocket };
