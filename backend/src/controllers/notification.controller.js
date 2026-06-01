const supabase = require('../config/supabase');

const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(username, avatar_url)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const { count: unread_count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    res.json({ success: true, notifications, unread_count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

const markRead = async (req, res) => {
  try {
    const { ids } = req.body; // array of notification ids, or empty to mark all
    let query = supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id);
    if (ids && ids.length > 0) query = query.in('id', ids);

    await query;
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications' });
  }
};

module.exports = { getNotifications, markRead };
