import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Users, ShieldCheck, Check, X, Camera, Image,
  CalendarDays, Clock, UserPlus, Upload, AlertCircle,
  ArrowRight, HardDrive, Zap, Flag, ExternalLink, Trash2, Plus,
  Search, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-400',
  photographer: 'bg-blue-500/20 text-blue-400',
  member: 'bg-green-500/20 text-green-400',
  viewer: 'bg-gray-500/20 text-gray-400',
};
const ROLES = ['viewer', 'member', 'photographer', 'admin'];

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FEED_ICONS = {
  join: { icon: UserPlus, color: 'text-green-400', bg: 'bg-green-500/10' },
  upload: { icon: Upload, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  role_request: { icon: ShieldCheck, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
};

function ActivityFeed({ items, onReview, onNavigate }) {
  if (!items.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
      <Clock size={32} className="mb-3 opacity-30" />
      <p className="text-sm">No recent activity</p>
    </div>
  );

  return (
    <div className="divide-y divide-dark-700">
      {items.map(item => {
        const { icon: Icon, color, bg } = FEED_ICONS[item.type] || FEED_ICONS.join;
        const isPending = item.type === 'role_request' && item.meta?.status === 'pending';
        const eventId = item.meta?.eventId;
        const isClickable = !!eventId;
        return (
          <div
            key={item.id}
            onClick={isClickable ? () => onNavigate(`/events/${eventId}`) : undefined}
            className={`flex items-start gap-3 px-5 py-3.5 hover:bg-dark-700/50 transition-all ${isClickable ? 'cursor-pointer group' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>
              <Icon size={14} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 leading-snug flex items-center gap-1.5 flex-wrap">
                {item.message}
                {isClickable && (
                  <ExternalLink size={11} className="text-gray-500 group-hover:text-primary-400 transition-colors flex-shrink-0" />
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Clock size={10} /> {timeAgo(item.timestamp)}
                {isClickable && <span className="text-primary-500/60 group-hover:text-primary-400 transition-colors">· View event</span>}
              </p>
            </div>
            {isPending && (
              <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => onReview(item.meta.requestId, 'approve')}
                  className="text-xs bg-green-500/15 hover:bg-green-500/25 text-green-400 px-2 py-1 rounded transition-all flex items-center gap-1">
                  <Check size={11} /> Approve
                </button>
                <button onClick={() => onReview(item.meta.requestId, 'reject')}
                  className="text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 px-2 py-1 rounded transition-all flex items-center gap-1">
                  <X size={11} /> Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickActionBlock({ icon: Icon, color, bg, label, value, sub, onClick, actionLabel }) {
  return (
    <div className={`rounded-xl border border-dark-600 p-4 ${onClick ? 'cursor-pointer hover:border-dark-500 transition-all' : ''}`}
      onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon size={16} className={color} />
        </div>
        {value !== undefined && (
          <span className={`text-2xl font-bold ${color}`}>{value}</span>
        )}
      </div>
      <p className="text-sm font-medium text-white leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      {actionLabel && onClick && (
        <p className={`text-xs mt-2 flex items-center gap-1 ${color}`}>
          {actionLabel} <ArrowRight size={10} />
        </p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [quickActions, setQuickActions] = useState(null);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [assignedMap, setAssignedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'viewer', club_name: '' });
  const [savingUser, setSavingUser] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // user object pending removal
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);
  // Users tab: search / filter / sort / inline role popover
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [rolePopover, setRolePopover] = useState(null); // { id, top, left }
  const navigate = useNavigate();

  const toggleSort = (key) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const visibleUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const filtered = users.filter(u => {
      const matchesQ = !q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesQ && matchesRole;
    });
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === 'username') return mul * (a.username || '').localeCompare(b.username || '');
      if (key === 'role') return mul * (ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
      return mul * ((new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0));
    });
  }, [users, userSearch, roleFilter, sort]);

  useEffect(() => { fetchTab(tab); }, [tab]);

  const fetchTab = async (t) => {
    setLoading(true);
    try {
      if (t === 'overview') {
        const res = await api.get('/admin/stats');
        setStats(res.data.stats);
        setActivityFeed(res.data.activityFeed || []);
        setQuickActions(res.data.quickActions || null);
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
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleReview = async (id, action) => {
    try {
      await api.post(`/admin/requests/${id}/review`, { action });
      toast.success(`Request ${action}d`);
      // Remove from feed + update counts
      setActivityFeed(prev => prev.filter(i => i.meta?.requestId !== id));
      setStats(prev => prev ? { ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) } : prev);
      setQuickActions(prev => prev ? { ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) } : prev);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to review request'); }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast.success('Role updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const res = await api.post('/admin/users', addForm);
      toast.success(res.data.message || 'User created');
      setUsers(prev => [res.data.user, ...prev]);
      setShowAddUser(false);
      setAddForm({ username: '', email: '', password: '', full_name: '', role: 'viewer', club_name: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.delete(`/admin/users/${removeTarget.id}`, { data: { reason: removeReason } });
      toast.success(`@${removeTarget.username} removed`);
      setUsers(prev => prev.filter(u => u.id !== removeTarget.id));
      setRemoveTarget(null);
      setRemoveReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove user');
    } finally {
      setRemoving(false);
    }
  };

  const handleAssign = async (photographerId) => {
    if (!selectedEvent) return toast.error('Select an event first');
    try {
      await api.post('/admin/assign-photographer', { event_id: selectedEvent, photographer_id: photographerId });
      toast.success('Photographer assigned!');
      setAssignedMap(prev => ({ ...prev, [`${selectedEvent}-${photographerId}`]: true }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const pendingBadge = stats?.pendingRequests ?? 0;
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Zap },
    { id: 'requests', label: 'Role Requests', icon: ShieldCheck },
    { id: 'users', label: 'Manage Users', icon: Users },
    { id: 'assign', label: 'Assign Photographers', icon: Camera },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Platform operations &amp; management</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-600 gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px
              ${tab === id ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            <Icon size={16} /> {label}
            {id === 'requests' && pendingBadge > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingBadge}
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
        <div className="space-y-5">
          {/* Operational stat strip — distinct from homepage's public-facing row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: ShieldCheck, label: 'Pending Requests', value: stats?.pendingRequests ?? '—', color: 'text-yellow-400', bg: 'bg-yellow-500/10', urgent: stats?.pendingRequests > 0 },
              { icon: UserPlus, label: 'New Users This Week', value: stats?.newUsersThisWeek ?? '—', color: 'text-green-400', bg: 'bg-green-500/10' },
              { icon: HardDrive, label: 'Storage Used', value: (() => { const mb = stats?.storageMB; if (mb == null) return '—'; if (mb === 0) return 'Empty'; if (mb >= 1024) return `${(mb/1024).toFixed(1)} GB`; if (mb < 1) return `${Math.round(mb * 1024)} KB`; return `${mb} MB`; })(), color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { icon: Flag, label: 'Total Media', value: stats?.totalMedia ?? '—', color: 'text-purple-400', bg: 'bg-purple-500/10' },
            ].map(({ icon: Icon, label, value, color, bg, urgent }) => (
              <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${urgent ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-dark-600 card'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${urgent ? 'text-yellow-400' : ''}`}>{value}</p>
                  <p className="text-xs text-gray-500 leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Activity feed — left/main column */}
            <div className="lg:col-span-2 card overflow-hidden">
              <div className="px-5 py-4 border-b border-dark-600 flex items-center gap-2">
                <Clock size={15} className="text-primary-400" />
                <h3 className="font-semibold text-sm">Activity Feed</h3>
                <span className="ml-auto text-xs text-gray-500">Chronological · last 25 events</span>
              </div>
              <ActivityFeed items={activityFeed} onReview={handleReview} onNavigate={navigate} />
            </div>

            {/* Quick actions — right column */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Quick Actions</h3>

              <QuickActionBlock
                icon={ShieldCheck}
                color="text-yellow-400"
                bg="bg-yellow-500/10"
                label="Pending Role Requests"
                value={quickActions?.pendingRequests ?? 0}
                sub={quickActions?.pendingRequests > 0 ? 'Require review' : 'All clear'}
                actionLabel="Go to requests"
                onClick={() => setTab('requests')}
              />

              <QuickActionBlock
                icon={UserPlus}
                color="text-green-400"
                bg="bg-green-500/10"
                label="New Users This Week"
                value={quickActions?.newUsersThisWeek ?? 0}
                sub="Joined in last 7 days"
                actionLabel="View all users"
                onClick={() => setTab('users')}
              />

              <div className="rounded-xl border border-dark-600 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <CalendarDays size={16} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Unassigned Events</p>
                    <p className="text-xs text-gray-500">{quickActions?.unassignedEvents?.length ?? 0} events without photographers</p>
                  </div>
                </div>
                {quickActions?.unassignedEvents?.length > 0 ? (
                  <div className="space-y-1.5">
                    {quickActions.unassignedEvents.map(ev => (
                      <button key={ev.id} onClick={() => { setTab('assign'); }}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 flex items-center justify-between transition-all">
                        <span className="truncate">{ev.name}</span>
                        <ArrowRight size={11} className="text-orange-400 flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-2">All events have photographers ✓</p>
                )}
              </div>
            </div>
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
          <div className="p-4 border-b border-dark-600 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">All Users <span className="text-gray-500 text-sm">({visibleUsers.length})</span></h3>
              <button onClick={() => setShowAddUser(true)}
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
                <Plus size={15} /> Add User
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  className="input text-sm pl-9 py-2" placeholder="Search by name or email..." />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="input text-sm py-2 w-40">
                <option value="all">All roles</option>
                {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
          </div>
          {visibleUsers.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-dark-600">
                  <tr>
                    {[
                      { key: 'username', label: 'User' },
                      { key: 'created_at', label: 'Joined' },
                      { key: 'role', label: 'Role' },
                    ].map(col => (
                      <th key={col.key} className="text-left p-4 text-sm font-medium text-gray-400">
                        <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-white transition-colors">
                          {col.label}
                          <ChevronDown size={13}
                            className={`transition-all ${sort.key === col.key ? 'text-primary-400' : 'text-gray-600'} ${sort.key === col.key && sort.dir === 'asc' ? 'rotate-180' : ''}`} />
                        </button>
                      </th>
                    ))}
                    <th className="text-right p-4 text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map(u => (
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
                        <div className="relative inline-block">
                          <button onClick={(e) => {
                            if (rolePopover?.id === u.id) { setRolePopover(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRolePopover({ id: u.id, top: rect.bottom + 4, left: rect.left });
                          }}
                            className={`badge capitalize ${ROLE_COLORS[u.role]} hover:ring-1 hover:ring-dark-500 transition-all`}>
                            {u.role} <ChevronDown size={11} />
                          </button>
                          {rolePopover?.id === u.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setRolePopover(null)} />
                              <div className="fixed z-20 card py-1 min-w-[150px] shadow-xl shadow-black/40"
                                style={{ top: rolePopover.top, left: rolePopover.left }}>
                                {ROLES.map(r => (
                                  <button key={r}
                                    onClick={() => { if (r !== u.role) handleRoleChange(u.id, r); setRolePopover(null); }}
                                    className={`w-full text-left px-3 py-1.5 text-sm capitalize flex items-center gap-2 hover:bg-dark-700 transition-colors ${r === u.role ? 'text-primary-400' : 'text-gray-300'}`}>
                                    {r}
                                    {r === u.role && <Check size={13} className="ml-auto" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => { setRemoveTarget(u); setRemoveReason(''); }}
                          className="inline-flex items-center gap-1.5 text-sm bg-red-500/15 hover:bg-red-500/25 text-red-400 px-3 py-1.5 rounded-lg transition-all">
                          <Trash2 size={14} /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left panel — events list */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-dark-600">
              <h3 className="font-medium">Events ({events.length})</h3>
              <p className="text-sm text-gray-400 mt-1">Pick an event to assign photographers</p>
            </div>
            {events.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No events found</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-dark-700">
                {events.map(ev => {
                  const active = String(selectedEvent) === String(ev.id);
                  return (
                    <button key={ev.id} onClick={() => setSelectedEvent(ev.id)}
                      className={`w-full flex items-center gap-3 p-4 text-left transition-all ${active ? 'bg-primary-600/15 border-l-2 border-primary-500' : 'border-l-2 border-transparent hover:bg-dark-700'}`}>
                      <div className="w-10 h-8 rounded-md bg-dark-700 overflow-hidden flex-shrink-0">
                        {ev.cover_image
                          ? <img src={ev.cover_image} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Camera size={14} className="text-dark-500" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${active ? 'text-primary-300' : ''}`}>{ev.name}</p>
                        <p className="text-xs text-gray-500">{ev.media_count || 0} media</p>
                      </div>
                      {active && <Check size={15} className="text-primary-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel — photographer picker */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-dark-600">
              <h3 className="font-medium">Photographers ({photographers.length})</h3>
              <p className="text-sm text-gray-400 mt-1">
                {selectedEvent ? 'Click Assign to add to the selected event' : 'Select an event first'}
              </p>
            </div>
            {photographers.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No photographers yet.</p>
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
                  disabled={!selectedEvent || assignedMap[`${selectedEvent}-${p.id}`]}
                  className={`text-sm py-1.5 px-3 rounded-lg transition-all ${
                    assignedMap[`${selectedEvent}-${p.id}`]
                      ? 'bg-green-500/20 text-green-400 cursor-default'
                      : 'btn-primary disabled:opacity-40'
                  }`}>
                  {assignedMap[`${selectedEvent}-${p.id}`]
                    ? <span className="flex items-center gap-1"><Check size={13} /> Assigned</span>
                    : 'Assign to Event'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !savingUser && setShowAddUser(false)}>
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><UserPlus size={18} className="text-primary-400" /> Add User</h3>
              <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Username *</label>
                <input className="input" value={addForm.username} required
                  onChange={e => setAddForm({ ...addForm, username: e.target.value })} placeholder="janedoe" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email *</label>
                <input type="email" className="input" value={addForm.email} required
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Password *</label>
                <input type="text" className="input" value={addForm.password} required
                  onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="Temporary password" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Full name</label>
                <input className="input" value={addForm.full_name}
                  onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Role</label>
                  <select className="input" value={addForm.role}
                    onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Club</label>
                  <input className="input" value={addForm.club_name}
                    onChange={e => setAddForm({ ...addForm, club_name: e.target.value })} placeholder="CIG" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)}
                  className="flex-1 py-2 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-700 transition-all text-sm">Cancel</button>
                <button type="submit" disabled={savingUser} className="btn-primary flex-1 justify-center py-2 text-sm">
                  {savingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove user confirm modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !removing && setRemoveTarget(null)}>
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Remove @{removeTarget.username}?</h3>
                <p className="text-sm text-gray-400 mt-1">
                  This permanently deletes the account. They'll be shown the message below
                  once on their next login attempt, then get the standard error afterwards.
                </p>
              </div>
            </div>
            <label className="block text-sm text-gray-300 mb-1">Message to show the user (optional)</label>
            <textarea className="input min-h-[80px] resize-y" value={removeReason}
              onChange={e => setRemoveReason(e.target.value)}
              placeholder="e.g. Your account was removed for violating club guidelines. Contact admin@cig.com to appeal." />
            <div className="flex gap-2 pt-4">
              <button onClick={() => setRemoveTarget(null)}
                className="flex-1 py-2 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-700 transition-all text-sm">Cancel</button>
              <button onClick={handleDeleteUser} disabled={removing}
                className="flex-1 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all text-sm flex items-center justify-center gap-1.5">
                <Trash2 size={14} /> {removing ? 'Removing...' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}