import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Home, Images, Search, Upload, Bookmark, User, LogOut,
  Bell, Camera, Plus, Menu, Shield, ShieldCheck, X, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationPanel from './NotificationPanel';

/* ── Nav item definition ────────────────────────────────────────────────── */
function useNavItems(user) {
  return [
    { to: '/',           icon: Home,       label: 'Home',       group: 'browse', show: true },
    { to: '/events',     icon: Images,     label: 'Events',     group: 'browse', show: true },
    { to: '/search',     icon: Search,     label: 'Search',     group: 'browse', show: true },
    { to: '/favourites', icon: Bookmark,   label: 'Favourites', group: 'myspace', show: !!user && user.role !== 'viewer' },
    { to: '/my-photos',  icon: Camera,     label: 'My Photos',  group: 'myspace', show: !!user },
    // role-based actions
    { to: '/admin',        icon: Shield,      label: 'Admin Panel',   group: 'actions', show: !!user && user.role === 'admin' },
    { to: '/events/new',   icon: Plus,        label: 'New Event',     group: 'actions', show: !!user && user.role === 'admin' },
    { to: '/upload',       icon: Upload,      label: 'Upload Media',  group: 'actions', show: !!user && ['admin','photographer'].includes(user.role) },
    { to: '/request-access', icon: ShieldCheck, label: 'Request Access', group: 'actions', show: !!user && user.role === 'viewer', accent: 'warning' },
  ];
}

/* ── Role badge colour map ──────────────────────────────────────────────── */
const ROLE_CLASS = {
  admin:        'badge-role-admin',
  photographer: 'badge-role-photographer',
  member:       'badge-role-member',
  viewer:       'badge-role-viewer',
};

/* ── Single nav link ────────────────────────────────────────────────────── */
function NavLink({ to, icon: Icon, label, active, collapsed, accent, onClick }) {
  const accentColor = accent === 'warning'
    ? (active ? 'text-yellow-400' : 'text-yellow-500 hover:text-yellow-400')
    : (active ? 'text-white' : 'text-gray-400 hover:text-white');

  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`
        flex items-center gap-3 rounded-lg transition-all duration-150 select-none
        ${collapsed ? 'px-0 py-2.5 justify-center w-full' : 'px-3 py-2.5'}
        ${accentColor}
        ${active
          ? 'bg-primary-600/15 border-l-2 border-primary-500 pl-[10px]'
          : 'hover:bg-dark-700 border-l-2 border-transparent'}
        ${collapsed && active ? 'border-l-0 bg-primary-600/15' : ''}
      `}
      style={collapsed ? { paddingLeft: 0, paddingRight: 0 } : {}}
    >
      <Icon size={18} className="flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
    </Link>
  );
}

/* ── Section divider label ─────────────────────────────────────────────── */
function NavSection({ label, collapsed }) {
  if (collapsed) return <div className="my-1 border-t border-dark-600/50" />;
  return (
    <p className="section-label px-3 pt-4 pb-1">{label}</p>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main Layout
   ───────────────────────────────────────────────────────────────────────── */
export default function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarExpanded, setSidebarExpanded] = useState(false); // desktop hover state
  const [focusWithin, setFocusWithin]         = useState(false); // keep open while typing
  const [mobileOpen, setMobileOpen]           = useState(false); // mobile drawer
  const [showNotifs, setShowNotifs]           = useState(false);
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const sidebarRef  = useRef(null);
  const notifBtnRef = useRef(null);

  const navItems = useNavItems(user);
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // Close transient menus on route change
  useEffect(() => { setMobileOpen(false); setShowUserMenu(false); setShowNotifs(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  // Group nav items
  const groups = {
    browse:  navItems.filter(n => n.show && n.group === 'browse'),
    myspace: navItems.filter(n => n.show && n.group === 'myspace'),
    actions: navItems.filter(n => n.show && n.group === 'actions'),
  };

  const expanded = sidebarExpanded || focusWithin; // desktop: hover OR focus inside
  const collapsed = !expanded;

  /* ── Sidebar content (shared between desktop & mobile) ──────────────── */
  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div
        className={`flex items-center border-b border-dark-600 flex-shrink-0
          ${collapsed && !isMobile ? 'justify-center py-4 px-0' : 'gap-3 px-5 py-4'}`}
        style={collapsed && !isMobile ? { paddingLeft: 0, paddingRight: 0 } : {}}
      >
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Camera size={16} className="text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="font-semibold text-base tracking-tight">CIG Media</span>
          )}
        </Link>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="icon-btn ml-auto"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-3 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`}>

        {groups.browse.length > 0 && (
          <>
            <NavSection label="Browse" collapsed={collapsed && !isMobile} />
            {groups.browse.map(item => (
              <NavLink
                key={item.to} {...item}
                active={isActive(item.to)}
                collapsed={collapsed && !isMobile}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </>
        )}

        {groups.myspace.length > 0 && (
          <>
            <NavSection label="My Space" collapsed={collapsed && !isMobile} />
            {groups.myspace.map(item => (
              <NavLink
                key={item.to} {...item}
                active={isActive(item.to)}
                collapsed={collapsed && !isMobile}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </>
        )}

        {groups.actions.length > 0 && (
          <>
            <NavSection label="Actions" collapsed={collapsed && !isMobile} />
            {groups.actions.map(item => (
              <NavLink
                key={item.to} {...item}
                active={isActive(item.to)}
                collapsed={collapsed && !isMobile}
                accent={item.accent}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Bottom: notifications + user */}
      <div className={`border-t border-dark-600 flex-shrink-0 py-3 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`}>

        {/* Notifications icon */}
        {user && (
          <button
            ref={collapsed && !isMobile ? notifBtnRef : undefined}
            onClick={() => setShowNotifs(v => !v)}
            className={`icon-btn mb-1 relative
              ${collapsed && !isMobile ? 'mx-auto' : 'w-full rounded-lg px-3 py-2.5 justify-start gap-3 text-gray-400 hover:text-white text-sm font-medium'}
            `}
            aria-label="Notifications"
          >
            <Bell size={18} className="flex-shrink-0" />
            {unreadCount > 0 && (
              <span className="notif-dot" style={(!collapsed || isMobile) ? { position: 'static', minWidth: 18, height: 18, borderRadius: 999, padding: '0 4px', marginLeft: 'auto', fontSize: 10 } : {}}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {(!collapsed || isMobile) && <span>Notifications</span>}
          </button>
        )}

        {/* User avatar → mini popover (profile / role / logout) */}
        {user ? (
          <div className="relative">
            {showUserMenu && (
              <div
                className={`absolute z-50 card p-1 shadow-xl shadow-black/40 animate-fade-in
                  ${collapsed && !isMobile ? 'left-full bottom-0 ml-2 w-52' : 'bottom-full left-0 right-0 mb-2'}`}
              >
                <div className="px-3 py-2 border-b border-dark-600 mb-1">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <span className={`${ROLE_CLASS[user.role] || 'badge-neutral'} capitalize mt-1.5 inline-flex`}>
                    <Shield size={10} className="mr-1" />{user.role}
                  </span>
                </div>
                <Link
                  to="/profile"
                  onClick={() => { setShowUserMenu(false); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition-colors"
                >
                  <User size={15} /> Profile
                </Link>
                <button
                  onClick={() => { setShowUserMenu(false); handleLogout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className={`flex items-center gap-3 rounded-lg w-full px-2 py-2 hover:bg-dark-700 transition-all
                ${collapsed && !isMobile ? 'justify-center px-0' : ''}`}
              title={collapsed && !isMobile ? user.username : undefined}
            >
              <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                {user.username?.[0]?.toUpperCase()}
              </div>
              {(!collapsed || isMobile) && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate leading-tight">{user.username}</p>
                    <span className={`${ROLE_CLASS[user.role] || 'badge-neutral'} capitalize mt-0.5`}>
                      {user.role}
                    </span>
                  </div>
                  <ChevronRight size={15} className={`text-gray-500 transition-transform ${showUserMenu ? '-rotate-90' : ''}`} />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className={`space-y-2 ${collapsed && !isMobile ? 'flex flex-col items-center' : ''}`}>
            <Link to="/login" className="btn-primary w-full justify-center text-sm">
              {collapsed && !isMobile ? <User size={16}/> : 'Login'}
            </Link>
            {(!collapsed || isMobile) && (
              <Link to="/register" className="btn-secondary w-full justify-center text-sm">
                Register
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-dark-900">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(e) => { if (!sidebarRef.current?.contains(e.relatedTarget)) setFocusWithin(false); }}
        className={`
          hidden lg:flex flex-col fixed inset-y-0 left-0 z-40
          bg-dark-800 border-r border-dark-600
          transition-all duration-200 overflow-visible
        `}
        style={{ width: expanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-collapsed)' }}
      >
        <SidebarContent />
      </aside>

      {/* ── User menu backdrop (closes popover on outside click) ─────────── */}
      {showUserMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
      )}

      {/* ── Notification panel (desktop, slides from sidebar edge) ──────── */}
      {showNotifs && (
        <>
          <div
            className="hidden lg:block fixed inset-0 z-30"
            onClick={() => setShowNotifs(false)}
          />
          <div
            className="hidden lg:block fixed z-50 top-0 bottom-0 animate-slide-in-right"
            style={{ left: expanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-collapsed)' }}
          >
            <NotificationPanel onClose={() => setShowNotifs(false)} />
          </div>
        </>
      )}

      {/* ── Mobile drawer backdrop ──────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer (bottom sheet) ────────────────────────────────── */}
      <div
        className={`
          fixed inset-x-0 bottom-0 z-40 lg:hidden
          bg-dark-800 border-t border-dark-600 rounded-t-[20px]
          transition-transform duration-200
          ${mobileOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="w-10 h-1 bg-dark-500 rounded-full mx-auto mt-3 mb-1" />
        <SidebarContent isMobile />
      </div>

      {/* ── Mobile notification panel ───────────────────────────────────── */}
      {showNotifs && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNotifs(false)} />
          <div className="relative animate-slide-up">
            <NotificationPanel onClose={() => setShowNotifs(false)} mobile />
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{
          marginLeft: 0,
          // On desktop, push content right to match whichever sidebar width is active.
          // The transition matches the sidebar's own transition so they move together.
          transition: 'margin-left 200ms ease',
        }}
      >
        {/* ── Mobile topbar ──────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 glass px-4 py-3 flex items-center gap-3 lg:hidden">
          <button
            className="icon-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Link to="/" className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
              <Camera size={12} className="text-white" />
            </div>
            <span className="font-semibold text-sm">CIG Media</span>
          </Link>
          {user && (
            <button
              ref={notifBtnRef}
              onClick={() => setShowNotifs(v => !v)}
              className="icon-btn relative"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="notif-dot">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </header>

        {/* Desktop: margin tracks the live sidebar width */}
        <div
          className="hidden lg:block min-h-screen"
          style={{
            marginLeft: expanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-collapsed)',
            transition: 'margin-left 200ms ease',
          }}
        >
          <main className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>

        {/* Mobile main */}
        <main className="flex-1 lg:hidden p-4">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav bar ───────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 glass border-t border-dark-600 flex items-center justify-around px-2 py-2">
        {[
          { to: '/',           icon: Home,    label: 'Home' },
          { to: '/events',     icon: Images,  label: 'Events' },
          { to: '/search',     icon: Search,  label: 'Search' },
          ...(user ? [{ to: '/my-photos', icon: Camera, label: 'Me' }] : []),
          ...(user && ['admin','photographer'].includes(user.role) ? [{ to: '/upload', icon: Upload, label: 'Upload' }] : []),
          ...(user ? [{ to: '/profile', icon: User, label: 'Profile' }] : [
            { to: '/login', icon: User, label: 'Login' },
          ]),
        ].slice(0, 5).map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all
              ${isActive(to) ? 'text-primary-400' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}