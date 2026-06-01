import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Users, ShieldCheck, Check, X, Camera, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-400',
  photographer: 'bg-blue-500/20 text-blue-400',
  member: 'bg-green-500/20 text-green-400',
  viewer: 'bg-gray-500/20 text-gray-400',
};

export default function AdminDashboard() {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'requests') {
        const res = await api.get('/admin/requests');
        setRequests(res.data.requests || []);
      } else if (tab === 'users') {
        const res = await api.get('/admin/users');
        setUsers(res.data.users || []);
      } else if (tab === 'assign') {
        const [evRes, usrRes] = await Promise.all([
          api.get('/events?limit=50'),
          api.get('/admin/users'),
        ]);
        setEvents(evRes.data.events || []);
        setPhotographers((usrRes.data.users || []).filter(u => u.role === 'photographer'));
      }
    } finally { setLoading(false); }
  };

  const handleReview = async (id, action) => {
    try {
      await api.post(`/admin/requests/${id}/review`, { action });
      toast.success(`Request ${action}d`);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) { toast.error('Failed'); }
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
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const tabs = [
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
            {id === 'requests' && requests.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
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
                    {r.user?.club_name && ` · Club: ${r.user.club_name}`}
                  </p>
                  {r.reason && <p className="text-sm text-gray-400 mt-1 italic">"{r.reason}"</p>}
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
          <table className="w-full">
            <thead className="border-b border-dark-600">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-400">User</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Club</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Role</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-dark-700 hover:bg-dark-700 transition-all">
                  <td className="p-4">
                    <p className="font-medium">@{u.username}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{u.club_name || '—'}</td>
                  <td className="p-4">
                    <span className={`badge capitalize ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="p-4">
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="input text-sm py-1.5 w-36">
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="photographer">Photographer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <p className="text-sm text-gray-400 mt-1">Select an event above then click Assign</p>
            </div>
            {photographers.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No photographers yet. Approve photographer requests first.</p>
            ) : photographers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 border-b border-dark-700 hover:bg-dark-700 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-semibold text-sm">
                    {p.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">@{p.username}</p>
                    <p className="text-sm text-gray-500">{p.email}</p>
                  </div>
                </div>
                <button onClick={() => handleAssign(p.id)} disabled={!selectedEvent}
                  className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40">
                  Assign to Event
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
