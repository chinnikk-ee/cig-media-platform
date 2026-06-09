import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { User, Shield, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-400',
  photographer: 'bg-blue-500/20 text-blue-400',
  member: 'bg-green-500/20 text-green-400',
  viewer: 'bg-gray-500/20 text-gray-400',
};

// Avatar ring + banner accent per role
const ROLE_RING = {
  admin: 'ring-red-500',
  photographer: 'ring-blue-500',
  member: 'ring-green-500',
  viewer: 'ring-gray-500',
};
const ROLE_BANNER = {
  admin: 'from-red-900/60 via-dark-800 to-dark-800',
  photographer: 'from-blue-900/60 via-dark-800 to-dark-800',
  member: 'from-green-900/50 via-dark-800 to-dark-800',
  viewer: 'from-dark-700 via-dark-800 to-dark-800',
};

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ full_name: user?.full_name || '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      updateUser(res.data.user);
      toast.success('Profile updated');
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      const { confirm_password, ...payload } = pwForm;
      await api.put('/auth/change-password', payload);
      toast.success('Password changed');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setChangingPw(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Profile header — banner + ring avatar + role chip */}
      <div className="card overflow-hidden">
        <div className={`h-28 bg-gradient-to-r ${ROLE_BANNER[user?.role] || ROLE_BANNER.viewer}`} />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className={`w-24 h-24 rounded-full bg-primary-600 text-white flex items-center justify-center text-3xl font-bold ring-4 ${ROLE_RING[user?.role] || ROLE_RING.viewer} ring-offset-4 ring-offset-dark-800 flex-shrink-0`}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="sm:pb-1">
              <p className="text-xl font-semibold">@{user?.username}</p>
              <p className="text-slate-500 text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`badge capitalize text-sm px-3 py-1 ${ROLE_COLORS[user?.role] || ''}`}>
                  <Shield size={12} className="inline mr-1" />{user?.role}
                </span>
                {user?.created_at && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <CalendarDays size={12} /> Joined {format(new Date(user.created_at), 'MMMM yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><User size={18} /> Edit Profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Full Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="input" placeholder="Your full name" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Shield size={18} /> Change Password</h2>
        <form onSubmit={handlePwChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Current Password</label>
            <input type="password" value={pwForm.current_password}
              onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })}
              className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">New Password</label>
            <input type="password" value={pwForm.new_password}
              onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })}
              className="input" minLength={8} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Confirm New Password</label>
            <input type="password" value={pwForm.confirm_password}
              onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })}
              className="input" minLength={8} required />
            {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
              <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
            )}
          </div>
          <button type="submit" disabled={changingPw} className="btn-primary">
            {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
