import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Home, Images, Search, Upload, Bookmark, User, LogOut, Bell, Camera, Plus, Menu, Shield, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationPanel from './NotificationPanel';

export default function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/login'); };
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const navItems = [
    { to: '/', icon: Home, label: 'Home', show: true },
    { to: '/events', icon: Images, label: 'Events', show: true },
    { to: '/search', icon: Search, label: 'Search', show: true },
    { to: '/favourites', icon: Bookmark, label: 'Favourites', show: !!user && user.role !== 'viewer' },
    { to: '/my-photos', icon: Camera, label: 'My Photos', show: !!user },
    { to: '/profile', icon: User, label: 'Profile', show: !!user },
  ];

  return (
    <div className="flex min-h-screen bg-dark-900">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-dark-800 border-r border-dark-600 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6 border-b border-dark-600">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center"><Camera size={20} /></div>
            <span className="font-semibold text-lg">CIG Media</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(n => n.show).map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive(to) ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
              <Icon size={18} />{label}
            </Link>
          ))}

          {/* Role-specific actions */}
          {user && (
            <>
              <div className="pt-4 pb-1 px-3 text-xs text-gray-600 uppercase tracking-wider">Actions</div>

              {/* Admin only */}
              {user.role === 'admin' && (
                <>
                  <Link to="/admin" onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${isActive('/admin') ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                    <Shield size={18} /> Admin Panel
                  </Link>
                  <Link to="/events/new" onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${isActive('/events/new') ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                    <Plus size={18} /> New Event
                  </Link>
                  <Link to="/upload" onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${isActive('/upload') ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                    <Upload size={18} /> Upload Media
                  </Link>
                </>
              )}

              {/* Photographer only */}
              {user.role === 'photographer' && (
                <Link to="/upload" onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive('/upload') ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                  <Upload size={18} /> Upload Media
                </Link>
              )}

              {/* Viewer only - request access */}
              {user.role === 'viewer' && (
                <Link to="/request-access" onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive('/request-access') ? 'bg-primary-600/20 text-primary-400' : 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-400/10'}`}>
                  <ShieldCheck size={18} /> Request Access
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-dark-600">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-semibold">
                  {user.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all w-full">
                <LogOut size={18} /> Logout
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link to="/login" className="btn-primary w-full justify-center text-sm">Login</Link>
              <Link to="/register" className="btn-secondary w-full justify-center text-sm">Register</Link>
            </div>
          )}
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 lg:ml-64 flex flex-col">
        <header className="sticky top-0 z-20 bg-dark-800/80 backdrop-blur-md border-b border-dark-600 px-4 py-3 flex items-center justify-between">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={22} className="text-gray-400" /></button>
          <div className="flex-1" />
          {user && (
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-all">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} />}
            </div>
          )}
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}