const supabase = require('../config/supabase');
const { createNotification } = require('../utils/notifications');

// ─── LIKE / UNLIKE ────────────────────────────────────────────
const toggleLike = async (req, res) => {
  try {
    const { media_id } = req.body;
    if (!media_id) return res.status(400).json({ success: false, message: 'media_id required' });

    // Check if already liked
    const { data: existing } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('media_id', media_id)
      .single();

    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id);
      const { count } = await supabase.from('likes').select('*', { count: 'exact' }).eq('media_id', media_id);
      return res.json({ success: true, liked: false, like_count: count });
    }

    await supabase.from('likes').insert({ user_id: req.user.id, media_id });
    const { count } = await supabase.from('likes').select('*', { count: 'exact' }).eq('media_id', media_id);

    // Notify media owner
    const { data: media } = await supabase.from('media').select('uploaded_by').eq('id', media_id).single();
    if (media && media.uploaded_by !== req.user.id) {
      await createNotification(req.io, {
        user_id: media.uploaded_by,
        actor_id: req.user.id,
        type: 'like',
        media_id,
        message: `${req.user.username} liked your photo`,
      });
    }

    res.json({ success: true, liked: true, like_count: count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle like' });
  }
};

// ─── ADD COMMENT ─────────────────────────────────────────────
const addComment = async (req, res) => {
  try {
    const { media_id, content } = req.body;
    if (!media_id || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'media_id and content required' });
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({ user_id: req.user.id, media_id, content: content.trim() })
      .select('*, users(username, avatar_url)')
      .single();

    if (error) throw error;

    // Notify media owner
    const { data: media } = await supabase.from('media').select('uploaded_by').eq('id', media_id).single();
    if (media && media.uploaded_by !== req.user.id) {
      await createNotification(req.io, {
        user_id: media.uploaded_by,
        actor_id: req.user.id,
        type: 'comment',
        media_id,
        message: `${req.user.username} commented on your photo: "${content.slice(0, 50)}"`,
      });
    }

    // Broadcast new comment to anyone viewing the media
    req.io.to(`media:${media_id}`).emit('new_comment', comment);

    res.status(201).json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

// ─── DELETE COMMENT ──────────────────────────────────────────
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: comment } = await supabase.from('comments').select('user_id').eq('id', id).single();

    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await supabase.from('comments').delete().eq('id', id);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
};

// ─── TOGGLE FAVOURITE ────────────────────────────────────────
const toggleFavourite = async (req, res) => {
  try {
    const { media_id } = req.body;
    if (!media_id) return res.status(400).json({ success: false, message: 'media_id required' });

    const { data: existing } = await supabase
      .from('favourites')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('media_id', media_id)
      .single();

    if (existing) {
      await supabase.from('favourites').delete().eq('id', existing.id);
      return res.json({ success: true, favourited: false });
    }

    await supabase.from('favourites').insert({ user_id: req.user.id, media_id });
    res.json({ success: true, favourited: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle favourite' });
  }
};

// ─── GET MY FAVOURITES ───────────────────────────────────────
const getMyFavourites = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('favourites')
      .select('media:media_id(*, events(name))')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, favourites: data.map(d => d.media) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch favourites' });
  }
};

// ─── TAG USER IN PHOTO ───────────────────────────────────────
const tagUser = async (req, res) => {
  try {
    const { media_id, tagged_user_id } = req.body;
    if (!media_id || !tagged_user_id) {
      return res.status(400).json({ success: false, message: 'media_id and tagged_user_id required' });
    }

    const { data: tag, error } = await supabase
      .from('media_tags')
      .insert({ media_id, tagged_by: req.user.id, tagged_user: tagged_user_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'User already tagged' });
      throw error;
    }

    // Notify tagged user
    await createNotification(req.io, {
      user_id: tagged_user_id,
      actor_id: req.user.id,
      type: 'tag',
      media_id,
      message: `${req.user.username} tagged you in a photo`,
    });

    res.status(201).json({ success: true, tag });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to tag user' });
  }
};

// ─── SHARE (just returns shareable link + increments) ────────
const shareMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const shareUrl = `${process.env.FRONTEND_URL}/media/${id}`;
    res.json({ success: true, share_url: shareUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate share link' });
  }
};

// ─── DELETE TAG ──────────────────────────────────────────────
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: tag } = await supabase
      .from('media_tags')
      .select('tagged_by, tagged_user')
      .eq('id', id)
      .single();

    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });

    // Only the person who tagged, the tagged user, or admin can remove
    if (tag.tagged_by !== req.user.id && tag.tagged_user !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await supabase.from('media_tags').delete().eq('id', id);
    res.json({ success: true, message: 'Tag removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove tag' });
  }
};

module.exports = { toggleLike, addComment, deleteComment, toggleFavourite, getMyFavourites, tagUser, shareMedia, deleteTag };