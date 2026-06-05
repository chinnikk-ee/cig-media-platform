const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ─── REGISTER ────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { email, password, username, full_name, role, club_name } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ success: false, message: 'Email, password and username are required' });
    }

    // Check duplicates
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email or username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Only allow admin/photographer roles if explicitly set (default viewer)
    const allowedRoles = ['viewer', 'member', 'photographer', 'admin'];
    const userRole = allowedRoles.includes(role) ? role : 'viewer';

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, password_hash, username, full_name, role: userRole, club_name })
      .select('id, email, username, full_name, role, club_name, avatar_url, created_at')
      .single();

    if (error) throw error;

    const token = generateToken(user.id);
    res.status(201).json({ success: true, message: 'Account created successfully', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

const DEFAULT_REMOVAL_MESSAGE =
  'Your account has been removed by an administrator and you no longer have access to the CIG platform.';

// Handle a login attempt for an email that has no active user. If a removal
// tombstone exists and the password is correct, show the one-time notice and
// delete the tombstone. Every other case returns the generic invalid response.
const handleRemovedUser = async (email, password, res) => {
  const { data: tomb } = await supabase
    .from('removed_users')
    .select('id, password_hash, reason')
    .eq('email', email)
    .single();

  if (tomb) {
    const isValid = await bcrypt.compare(password, tomb.password_hash);
    if (isValid) {
      // Consume the one-time notice — next attempt gets the generic error.
      await supabase.from('removed_users').delete().eq('id', tomb.id);
      return res.status(403).json({
        success: false,
        removed: true,
        message: tomb.reason || DEFAULT_REMOVAL_MESSAGE,
      });
    }
  }

  return res.status(401).json({ success: false, message: 'Invalid email or password' });
};

// ─── LOGIN ───────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      // No active account — but this email may belong to a user an admin
      // removed. If so, show the one-time removal notice (correct password
      // only), then drop the tombstone so future attempts are generic.
      return await handleRemovedUser(email, password, res);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    res.json({ success: true, message: 'Login successful', token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// ─── GET PROFILE ─────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, full_name, role, club_name, avatar_url, selfie_url, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// ─── UPDATE PROFILE ──────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { full_name, club_name, avatar_url } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (club_name !== undefined) updates.club_name = club_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    updates.updated_at = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, email, username, full_name, role, club_name, avatar_url')
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// ─── CHANGE PASSWORD ─────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    const isValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password_hash }).eq('id', req.user.id);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

module.exports = { register, login, getProfile, updateProfile, changePassword };
