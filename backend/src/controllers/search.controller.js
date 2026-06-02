const supabase = require('../config/supabase');

const search = async (req, res) => {
  try {
    const { q, type = 'all', tags, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const results = {};

    if (type === 'all' || type === 'events') {
      let eventsQuery = supabase
        .from('events_with_counts')
        .select('*')
        .eq('is_public', true);

      if (q) eventsQuery = eventsQuery.ilike('name', `%${q}%`);
      if (start_date) eventsQuery = eventsQuery.gte('event_date', start_date);
      if (end_date)   eventsQuery = eventsQuery.lte('event_date', end_date);

      // Require at least one filter to avoid returning everything
      if (q || start_date || end_date) {
        eventsQuery = eventsQuery.order('event_date', { ascending: false }).limit(10);
        const { data: events } = await eventsQuery;
        results.events = events || [];
      } else {
        results.events = [];
      }
    }

    if (type === 'all' || type === 'media') {
      let mediaQuery = supabase.from('media_with_counts').select('*').eq('is_public', true);

      if (q)          mediaQuery = mediaQuery.ilike('file_name', `%${q}%`);
      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim());
        mediaQuery = mediaQuery.overlaps('ai_tags', tagArray);
      }
      if (start_date) mediaQuery = mediaQuery.gte('created_at', start_date);
      if (end_date)   mediaQuery = mediaQuery.lte('created_at', end_date + 'T23:59:59');

      mediaQuery = mediaQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data: media } = await mediaQuery;
      results.media = media || [];
    }

    if ((type === 'all' || type === 'users') && q) {
      const { data: users } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, role')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .eq('is_active', true)
        .limit(10);
      results.users = users || [];
    }

    res.json({ success: true, results, query: q });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

module.exports = { search };