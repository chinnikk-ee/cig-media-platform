import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', username: '', full_name: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { confirm_password, ...payload } = form;
      await register({ ...payload, role: 'viewer' });
      toast.success('Account created! You joined as a Viewer.');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4">
            <Camera size={28} />
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-slate-500 mt-2">Join the CIG Media Platform</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Username *</label>
                <input type="text" value={form.username} onChange={set('username')} className="input" placeholder="john_doe" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Full Name</label>
                <input type="text" value={form.full_name} onChange={set('full_name')} className="input" placeholder="John Doe" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Email *</label>
              <input type="email" value={form.email} onChange={set('email')} className="input" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Password *</label>
              <input type="password" value={form.password} onChange={set('password')} className="input" placeholder="Min 8 characters" required minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Confirm Password *</label>
              <input type="password" value={form.confirm_password} onChange={set('confirm_password')} className="input" placeholder="Re-enter your password" required minLength={8} />
              {form.confirm_password && form.password !== form.confirm_password && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Role info box */}
            <div className="bg-dark-700 rounded-lg p-3 text-sm text-slate-500">
              You'll join as a <span className="text-slate-800 font-medium">Viewer</span>. To get upload or member access, request a role upgrade after registering.
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
