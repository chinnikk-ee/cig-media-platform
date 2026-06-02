import { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  Users, ShieldCheck, Check, X, Camera, Image,
  CalendarDays, Clock, TrendingUp, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-400',
  photographer: 'bg-blue-500/20 text-blue-400',
  member: 'bg-green-500/20 text-green-400',
  viewer: 'bg-gray-500/20 text-gray-400',
};

const ROLES = ['viewer', 'member', 'photographer', 'admin'];

function StatCard({ icon: Icon, label, value, color = 'text-primary-400', sub }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('-400', '-500/20')}`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value ?? '—'}</p>
        <p className="text-sm text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [assignedMap, setAssignedMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTab(tab); }, [tab]);

  const fetchTab = async (t) => {
    setLoading(true);
    try {
      if (t === 'overview') {
        const res = await api.get('/admin/stats');
        setStats(res.data.stats);
        setRecentUsers(res.data.recentUsers || []);
        setRecentMedia(res.data.recentMedia || []);
      } else if (t === 'requests') {
        const res = await api.get('/admin/requests');
        setRequests(res.data.requests || []);
      } else if (t === 'users') {
        const res = await api.get('/admin/users');
        setUsers(res.data.users || []);
      } else if (t === 'assign') {
        const [evRes, usrRes] = await Promise.all([
          api.get('/events?limit=50'),
          api.get('/admin/users'),
        ]);
        setEvents(evRes.data.events || []);
        setPhotographers((usrRes.data.users || []).filter(u => u.role === 'photographer'));
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, action) => {
    try {
      await api.post(`/admin/requests/${id}/review`, { action });
      toast.success(`Request ${action}d`);
      setRequests(prev => prev.filter(r => r.id !== id));
      // Refresh stats badge
      setStats(prev => prev ? { ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) } : prev);
    } catch { toast.error('Failed'); }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast.success('Role updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleAssign = async (photographerId) => {
    if (!selectedEvent) return toast.error('Select an event first');
    try {
      await api.post('/admin/assign-photographer', { event_id: selectedEvent, photographer_id: photographerId });
      toast.success('Photographer assigned!');
      setAssignedMap(prev => ({ ...prev, [`${selectedEvent}-${photographerId}`]: true }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const isAssigned = (pId) => assignedMap[`${selectedEvent}-${pId}`];

  const pendingCount = stats?.pendingRequests ?? requests.filter(r => r.status === 'pending').length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'requests', label: 'Role Requests', icon: ShieldCheck },
    { id: 'users', label: 'Manage Users', icon: Users },
    { id: 'assign', label: 'Assign Photographers', icon: Camera },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Manage users, roles, and event assignments</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-600 gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px
              ${tab === id ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            <Icon size={16} /> {label}
            {id === 'requests' && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : tab === 'overview' ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Users" value={stats?.totalUsers} color="text-primary-400" />
            <StatCard icon={CalendarDays} label="Total Events" value={stats?.totalEvents} color="text-blue-400" />
            <StatCard icon={Image} label="Total Media" value={stats?.totalMedia} color="text-green-400" />
            <StatCard icon={ShieldCheck} label="Pending Requests" value={stats?.pendingRequests} color="text-yellow-400"
              sub={stats?.pendingRequests > 0 ? 'Needs review' : 'All clear'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={Camera} label="Photographers" value={stats?.photographers} color="text-purple-400" />
            <StatCard icon={UserCheck} label="Active Members" value={
              stats ? stats.totalUsers - (stats.photographers || 0) : null
            } color="text-cyan-400" />
          </div>

          {/* Recent Users */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-dark-600 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Users size={16} className="text-primary-400" /> Recent Users</h3>
              <button onClick={() => setTab('users')} className="text-xs text-primary-400 hover:text-primary-300">View all →</button>
            </div>
            {recentUsers.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No users yet</p>
            ) : recentUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-dark-700 last:border-0 hover:bg-dark-700 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-semibold">
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">@{u.username}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge capitalize text-xs ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={11} /> {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Uploads */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-dark-600">
              <h3 className="font-semibold flex items-center gap-2"><Image size={16} className="text-green-400" /> Recent Uploads</h3>
            </div>
            {recentMedia.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No media yet</p>
            ) : (
              <div className="divide-y divide-dark-700">
                {recentMedia.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 transition-all">
                    {m.thumbnail_url || m.url ? (
                      <img src={m.thumbnail_url || m.url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center flex-shrink-0">
                        <Image size={16} className="text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.file_name || 'Untitled'}</p>
                      <p className="text-xs text-gray-500">
                        by @{m.users?.username || '?'} · {m.events?.name || 'No event'} · {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      ) : tab === 'requests' ? (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <ShieldCheck size={36} className="mx-auto mb-3 opacity-30" />
              <p>No pending requests</p>
            </div>
          ) : requests.map(r => (
            <div key={r.id} className="card p-5 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-semibold flex-shrink-0">
                  {r.user?.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">@{r.user?.username} <span className="text-gray-500 text-sm">({r.user?.email})</span></p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Requesting: <span className="text-white capitalize font-medium">{r.requested_role}</span>
                  </p>
                  {r.reason && <p className="text-sm text-gray-400 mt-1 italic">"{r.reason}"</p>}
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock size={11} /> {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReview(r.id, 'approve')}
                  className="flex items-center gap-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-sm transition-all">
                  <Check size={14} /> Approve
                </button>
                <button onClick={() => handleReview(r.id, 'reject')}
                  className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-sm transition-all">
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>

      ) : tab === 'users' ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-dark-600 flex items-center justify-between">
            <h3 className="font-medium">All Users <span className="text-gray-500 text-sm">({users.length})</span></h3>
          </div>
          {users.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-dark-600">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">User</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Joined</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Role</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-dark-700 hover:bg-dark-700 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-semibold">
                            {u.username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">@{u.username}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-400 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`badge capitalize ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                      </td>
                      <td className="p-4">
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="input text-sm py-1.5 w-36">
                          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      ) : (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-medium mb-3">Select Event</h3>
            <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="input">
              <option value="">Choose an event...</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-dark-600">
              <h3 className="font-medium">Photographers ({photographers.length})</h3>
              <p className="text-sm text-gray-400 mt-1">
                {selectedEvent ? 'Click Assign to add a photographer to the selected event' : 'Select an event above first'}
              </p>
            </div>
            {photographers.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No photographers yet. Approve photographer requests first.</p>
            ) : photographers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 border-b border-dark-700 last:border-0 hover:bg-dark-700 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-semibold text-sm">
                    {p.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">@{p.username}</p>
                    <p className="text-sm text-gray-500">{p.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAssign(p.id)}
                  disabled={!selectedEvent || isAssigned(p.id)}
                  className={`text-sm py-1.5 px-3 rounded-lg transition-all ${
                    isAssigned(p.id)
                      ? 'bg-green-500/20 text-green-400 cursor-default'
                      : 'btn-primary disabled:opacity-40'
                  }`}>
                  {isAssigned(p.id) ? <span className="flex items-center gap-1"><Check size={13} /> Assigned</span> : 'Assign to Event'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}