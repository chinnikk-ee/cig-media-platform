import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Pending Review' },
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Rejected' },
};

export default function RequestAccessPage() {
  const { user } = useAuth();
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({ requested_role: 'member', reason: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/admin/my-request')
      .then(res => setExisting(res.data.request))
      .catch(() => toast.error('Failed to load your request status'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/request-role', form);
      toast.success('Request submitted! An admin will review it soon.');
      const res = await api.get('/admin/my-request');
      setExisting(res.data.request);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  // Already has elevated role
  if (user?.role !== 'viewer') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">You already have {user?.role} access</h1>
        <p className="text-slate-500 mt-2">You can access all features available to your role.</p>
      </div>
    );
  }

  // Has existing request
  if (existing) {
    const style = STATUS_STYLES[existing.status] || STATUS_STYLES.pending;
    const Icon = style.icon;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Request Access</h1>
        <div className={`card p-6 ${style.bg} border-0`}>
          <div className="flex items-center gap-3 mb-4">
            <Icon size={24} className={style.color} />
            <h2 className={`font-semibold text-lg ${style.color}`}>{style.label}</h2>
          </div>
          <p className="text-slate-600">
            Your request for <span className="font-medium text-slate-800 capitalize">{existing.requested_role}</span> access is {existing.status}.
          </p>
          {existing.reason && (
            <p className="text-slate-500 text-sm mt-3 italic">"{existing.reason}"</p>
          )}
          {existing.status === 'rejected' && (
            <button onClick={() => setExisting(null)} className="btn-primary mt-4 text-sm">
              Submit New Request
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <ShieldCheck size={24} className="text-primary-400" /> Request Access
        </h1>
        <p className="text-slate-500 mt-1">Request an elevated role from the admin</p>
      </div>

      {/* Role comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`card p-4 cursor-pointer transition-all ${form.requested_role === 'member' ? 'border-primary-500' : ''}`}
          onClick={() => setForm({ ...form, requested_role: 'member' })}>
          <h3 className="font-semibold mb-2">Club Member</h3>
          <ul className="text-sm text-slate-500 space-y-1">
            <li>✅ View private events</li>
            <li>✅ Like & comment photos</li>
            <li>✅ Add to favourites</li>
            <li>❌ Cannot upload</li>
          </ul>
        </div>
        <div className={`card p-4 cursor-pointer transition-all ${form.requested_role === 'photographer' ? 'border-primary-500' : ''}`}
          onClick={() => setForm({ ...form, requested_role: 'photographer' })}>
          <h3 className="font-semibold mb-2">Photographer</h3>
          <ul className="text-sm text-slate-500 space-y-1">
            <li>✅ View private events</li>
            <li>✅ Like & comment photos</li>
            <li>✅ Upload to assigned events</li>
            <li>✅ Delete own uploads</li>
          </ul>
        </div>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Reason for request</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="input resize-none h-28"
              placeholder="Tell the admin why you need this access, your role in the club, etc." required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3">
            {submitting ? 'Submitting...' : `Request ${form.requested_role === 'member' ? 'Club Member' : 'Photographer'} Access`}
          </button>
        </form>
      </div>
    </div>
  );
}
