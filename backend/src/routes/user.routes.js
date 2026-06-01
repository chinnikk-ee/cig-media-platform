const router = require('express').Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth.middleware');

// Search users (for tagging autocomplete)
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, users: [] });

    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .eq('is_active', true)
      .neq('id', req.user.id)
      .limit(10);

    res.json({ success: true, users: users || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Get user public profile
router.get('/:id', async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, role, club_name, created_at')
      .eq('id', req.params.id)
      .single();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

module.exports = router;
