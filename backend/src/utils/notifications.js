const supabase = require('../config/supabase');

const createNotification = async (io, { user_id, actor_id, type, media_id, event_id, message }) => {
  try {
    const { data: notification } = await supabase
      .from('notifications')
      .insert({ user_id, actor_id, type, media_id, event_id, message })
      .select('*, actor:actor_id(username, avatar_url)')
      .single();

    // Emit real-time notification to the user's personal room
    if (io && notification) {
      io.to(`user:${user_id}`).emit('notification:new', notification);
    }

    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

module.exports = { createNotification };
