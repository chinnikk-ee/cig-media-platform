const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// ─── CREATE EVENT ────────────────────────────────────────────
const createEvent = async (req, res) => {
  try {
    const { name, description, category, event_date, location, is_public, cover_image } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Event name is required' });

    // Generate QR code for album sharing
    const eventId = uuidv4();
    const shareUrl = `${process.env.FRONTEND_URL}/events/${eventId}`;
    let qr_code = null;
    try {
      qr_code = await QRCode.toDataURL(shareUrl);
    } catch (_) {}

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: eventId,
        name,
        description,
        category,
        event_date,
        location,
        is_public: is_public !== undefined ? is_public : true,
        cover_image,
        created_by: req.user.id,
        club_name: 'CIG',
        qr_code,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Event created', event });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

// ─── GET ALL EVENTS ──────────────────────────────────────────
const getEvents = async (req, res) => {
  try {
    const { sort_by = 'created_at', order = 'desc', category, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const isAdmin = req.user && ['admin', 'photographer', 'member'].includes(req.user.role);

    let query = supabase
      .from('events_with_counts')
      .select('*');

    // Non-members only see public events
    if (!isAdmin) query = query.eq('is_public', true);
    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);

    const validSorts = ['created_at', 'event_date', 'name', 'media_count'];
    const sortCol = validSorts.includes(sort_by) ? sort_by : 'created_at';
    query = query.order(sortCol, { ascending: order === 'asc' }).range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;
    if (error) throw error;

    res.json({ success: true, events, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

// ─── GET SINGLE EVENT ────────────────────────────────────────
const getEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error } = await supabase
      .from('events_with_counts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Block non-members from private events
    if (!event.is_public && (!req.user || req.user.role === 'viewer')) {
      return res.status(403).json({ success: false, message: 'This event is private' });
    }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch event' });
  }
};

// ─── UPDATE EVENT ────────────────────────────────────────────
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, event_date, location, is_public, cover_image } = req.body;

    // Only creator or admin can update
    const { data: existing } = await supabase.from('events').select('created_by').eq('id', id).single();
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });
    if (existing.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (event_date !== undefined) updates.event_date = event_date;
    if (location !== undefined) updates.location = location;
    if (is_public !== undefined) updates.is_public = is_public;
    if (cover_image !== undefined) updates.cover_image = cover_image;

    const { data: event, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Event updated', event });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

// ─── DELETE EVENT ────────────────────────────────────────────
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase.from('events').select('created_by').eq('id', id).single();
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });
    if (existing.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
    }

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};

// ─── GET EVENT MEDIA ─────────────────────────────────────────
const getEventMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Only admin/photographer/member may see private media.
    // Viewers and logged-out visitors get public media only.
    const canSeePrivate = req.user && req.user.role !== 'viewer';

    let query = supabase
      .from('media_with_counts')
      .select('*')
      .eq('event_id', id);

    if (!canSeePrivate) query = query.eq('is_public', true);

    const { data: media, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // If user is logged in, also fetch their liked/favourited ids
    let userLikes = [], userFavs = [];
    if (req.user) {
      const mediaIds = media.map(m => m.id);
      const [likesRes, favsRes] = await Promise.all([
        supabase.from('likes').select('media_id').eq('user_id', req.user.id).in('media_id', mediaIds),
        supabase.from('favourites').select('media_id').eq('user_id', req.user.id).in('media_id', mediaIds),
      ]);
      userLikes = (likesRes.data || []).map(l => l.media_id);
      userFavs = (favsRes.data || []).map(f => f.media_id);
    }

    const enriched = media.map(m => ({
      ...m,
      is_liked: userLikes.includes(m.id),
      is_favourited: userFavs.includes(m.id),
    }));

    res.json({ success: true, media: enriched, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch event media' });
  }
};

module.exports = { createEvent, getEvents, getEvent, updateEvent, deleteEvent, getEventMedia };
