const supabase = require('../config/supabase');

// Check if photographer is assigned to a specific event
const isAssignedPhotographer = async (userId, eventId) => {
  const { data } = await supabase
    .from('event_photographers')
    .select('id')
    .eq('photographer_id', userId)
    .eq('event_id', eventId)
    .single();
  return !!data;
};

// Check if user can upload to an event
const canUploadToEvent = async (req, res, next) => {
  try {
    const { event_id } = req.body;
    const user = req.user;

    if (!event_id) return res.status(400).json({ success: false, message: 'event_id required' });

    // Admin can upload anywhere
    if (user.role === 'admin') return next();

    // Photographer must be assigned to this event
    if (user.role === 'photographer') {
      const assigned = await isAssignedPhotographer(user.id, event_id);
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this event' });
      }
      return next();
    }

    // Members and viewers cannot upload
    return res.status(403).json({ success: false, message: 'You do not have upload permission' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};

// Check if user can delete a specific media
const canDeleteMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Admin can delete anything
    if (user.role === 'admin') return next();

    const { data: media } = await supabase
      .from('media')
      .select('uploaded_by, event_id')
      .eq('id', id)
      .single();

    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    // Photographer can delete their own uploads in assigned events
    if (user.role === 'photographer') {
      if (media.uploaded_by !== user.id) {
        return res.status(403).json({ success: false, message: 'You can only delete your own uploads' });
      }
      const assigned = await isAssignedPhotographer(user.id, media.event_id);
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this event' });
      }
      return next();
    }

    return res.status(403).json({ success: false, message: 'You do not have delete permission' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};

// Check if user can view private event
const canViewEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const { data: event } = await supabase
      .from('events')
      .select('is_public, club_name')
      .eq('id', id)
      .single();

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Public events - anyone can view
    if (event.is_public) return next();

    // Private events - must be logged in
    if (!user) return res.status(403).json({ success: false, message: 'Login to view private events' });

    // Admin and photographer can view all private events
    if (['admin', 'photographer'].includes(user.role)) return next();

    // Club member can view private events of their club
    if (user.role === 'member' && user.club_name === event.club_name) return next();

    // Viewers cannot view private events
    return res.status(403).json({ success: false, message: 'This event is private' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};

// Check if user can interact (like, comment, favourite)
const canInteract = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Login required' });
  if (req.user.role === 'viewer') {
    return res.status(403).json({ success: false, message: 'Viewers cannot interact. Request member access first.' });
  }
  next();
};

module.exports = { canUploadToEvent, canDeleteMedia, canViewEvent, canInteract, isAssignedPhotographer };
