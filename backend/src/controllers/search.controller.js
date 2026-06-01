const supabase = require('../config/supabase');

const search = async (req, res) => {
  try {
    const { q, type = 'all', tags, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const results = {};

    if ((type === 'all' || type === 'events') && q) {
      const { data: events } = await supabase
        .from('events_with_counts')
        .select('*')
        .ilike('name', `%${q}%`)
        .eq('is_public', true)
        .limit(10);
      results.events = events || [];
    }

    if (type === 'all' || type === 'media') {
      let query = supabase.from('media_with_counts').select('*').eq('is_public', true);

      if (q) query = query.ilike('file_name', `%${q}%`);
      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim());
        query = query.overlaps('ai_tags', tagArray);
      }
      if (start_date) query = query.gte('created_at', start_date);
      if (end_date) query = query.lte('created_at', end_date);

      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data: media } = await query;
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
