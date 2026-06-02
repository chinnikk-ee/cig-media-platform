const supabase = require('../config/supabase');

// ─── REQUEST ROLE UPGRADE (viewer only) ──────────────────────
const requestRole = async (req, res) => {
  try {
    const { requested_role, reason } = req.body;

    if (!['member', 'photographer'].includes(requested_role)) {
      return res.status(400).json({ success: false, message: 'Can only request member or photographer role' });
    }

    if (req.user.role !== 'viewer') {
      return res.status(400).json({ success: false, message: 'You already have an elevated role' });
    }

    // Check if already has a pending request
    const { data: existing } = await supabase
      .from('role_requests')
      .select('id, status')
      .eq('user_id', req.user.id)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a pending request' });
    }

    const { data: request, error } = await supabase
      .from('role_requests')
      .insert({ user_id: req.user.id, requested_role, reason })
      .select()
      .single();

    if (error) throw error;

    // Notify all admins
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    const { createNotification } = require('../utils/notifications');
    for (const admin of admins || []) {
      await createNotification(req.io, {
        user_id: admin.id,
        actor_id: req.user.id,
        type: 'upload',
        message: `${req.user.username} requested ${requested_role} access`,
      });
    }

    res.status(201).json({ success: true, message: 'Role request submitted', request });
  } catch (err) {
    console.error('Role request error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit request' });
  }
};

// ─── GET MY ROLE REQUEST STATUS ──────────────────────────────
const getMyRequest = async (req, res) => {
  try {
    const { data: request } = await supabase
      .from('role_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({ success: true, request: request || null });
  } catch {
    res.json({ success: true, request: null });
  }
};

// ─── GET ALL PENDING REQUESTS (admin only) ───────────────────
const getPendingRequests = async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('role_requests')
      .select('*, user:user_id(id, username, email, full_name, club_name, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, requests: requests || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
};

// ─── APPROVE / REJECT REQUEST (admin only) ───────────────────
const reviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
    }

    const { data: request } = await supabase
      .from('role_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already reviewed' });
    }

    // Update request status
    await supabase
      .from('role_requests')
      .update({ status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', id);

    // If approved, update user role
    if (action === 'approve') {
      await supabase
        .from('users')
        .update({ role: request.requested_role, club_name: 'CIG', updated_at: new Date().toISOString() })
        .eq('id', request.user_id);
    }

    // Notify the user
    const { createNotification } = require('../utils/notifications');
    await createNotification(req.io, {
      user_id: request.user_id,
      actor_id: req.user.id,
      type: 'upload',
      message: action === 'approve'
        ? `Your request for ${request.requested_role} access has been approved!`
        : `Your request for ${request.requested_role} access was rejected.`,
    });

    res.json({ success: true, message: `Request ${action}d successfully` });
  } catch (err) {
    console.error('Review request error:', err);
    res.status(500).json({ success: false, message: 'Failed to review request' });
  }
};

// ─── GET ALL USERS (admin only) ──────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, username, full_name, role, club_name, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, users: users || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// ─── UPDATE USER ROLE DIRECTLY (admin only) ──────────────────
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['viewer', 'member', 'photographer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: "You can't change your own role" });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, username, role')
      .single();

    if (error) throw error;
    res.json({ success: true, message: `Role updated to ${role}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
};

// ─── ASSIGN PHOTOGRAPHER TO EVENT (admin only) ───────────────
const assignPhotographer = async (req, res) => {
  try {
    const { event_id, photographer_id } = req.body;

    // Verify the user is actually a photographer
    const { data: user } = await supabase
      .from('users')
      .select('role, username')
      .eq('id', photographer_id)
      .single();

    if (!user || user.role !== 'photographer') {
      return res.status(400).json({ success: false, message: 'User must have photographer role' });
    }

    const { data: assignment, error } = await supabase
      .from('event_photographers')
      .insert({ event_id, photographer_id, assigned_by: req.user.id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Already assigned to this event' });
      throw error;
    }

    // Notify photographer
    const { createNotification } = require('../utils/notifications');
    await createNotification(req.io, {
      user_id: photographer_id,
      actor_id: req.user.id,
      type: 'upload',
      event_id,
      message: `You've been assigned as photographer for an event`,
    });

    res.status(201).json({ success: true, message: `${user.username} assigned to event`, assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to assign photographer' });
  }
};

// ─── REMOVE PHOTOGRAPHER FROM EVENT (admin only) ─────────────
const removePhotographer = async (req, res) => {
  try {
    const { event_id, photographer_id } = req.body;

    await supabase
      .from('event_photographers')
      .delete()
      .eq('event_id', event_id)
      .eq('photographer_id', photographer_id);

    res.json({ success: true, message: 'Photographer removed from event' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove photographer' });
  }
};

// ─── GET EVENT PHOTOGRAPHERS (admin) ─────────────────────────
const getEventPhotographers = async (req, res) => {
  try {
    const { event_id } = req.params;

    const { data: photographers, error } = await supabase
      .from('event_photographers')
      .select('*, photographer:photographer_id(id, username, full_name, avatar_url, email)')
      .eq('event_id', event_id);

    if (error) throw error;
    res.json({ success: true, photographers: photographers || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch photographers' });
  }
};

// ─── DASHBOARD STATS (admin only) ────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalEvents },
      { count: totalMedia },
      { count: pendingRequests },
      { count: photographers },
      { data: recentUsers },
      { data: recentMedia },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('media').select('*', { count: 'exact', head: true }),
      supabase.from('role_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'photographer'),
      supabase.from('users').select('id, username, email, role, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('media').select('id, file_name, url, thumbnail_url, created_at, uploaded_by, event_id, events(name), users!media_uploaded_by_fkey(username)').order('created_at', { ascending: false }).limit(5),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        totalEvents: totalEvents || 0,
        totalMedia: totalMedia || 0,
        pendingRequests: pendingRequests || 0,
        photographers: photographers || 0,
      },
      recentUsers: recentUsers || [],
      recentMedia: recentMedia || [],
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

module.exports = {
  requestRole, getMyRequest, getPendingRequests, reviewRequest,
  getAllUsers, updateUserRole, assignPhotographer, removePhotographer,
  getEventPhotographers, getDashboardStats
};