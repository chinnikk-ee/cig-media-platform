/**
 * EmptyState
 * ──────────
 * Standardised empty state shown when a list/grid has no content.
 * Every page that can be empty uses this instead of ad-hoc text.
 *
 * Props:
 *   icon      — Lucide icon component (required)
 *   title     — short headline (required)
 *   message   — supporting description (optional)
 *   action    — { label, onClick | href } — renders a primary CTA button
 *   secondaryAction — { label, onClick | href } — ghost secondary button
 *   className — extra classes on the root
 *   size      — 'sm' | 'md' (default) | 'lg' — controls padding + icon size
 *
 * Usage:
 *   <EmptyState
 *     icon={ImageOff}
 *     title="No photos yet"
 *     message="Photos uploaded to this event will appear here."
 *     action={{ label: 'Upload Photos', href: '/upload' }}
 *   />
 */

import { Link } from 'react-router-dom';

const SIZE = {
  sm: { wrap: 'py-10',   icon: 32, title: 'text-sm',  msg: 'text-xs' },
  md: { wrap: 'py-16',   icon: 40, title: 'text-base', msg: 'text-sm' },
  lg: { wrap: 'py-24',   icon: 52, title: 'text-lg',  msg: 'text-sm' },
};

function ActionButton({ action, variant = 'primary' }) {
  if (!action) return null;
  const base = variant === 'primary' ? 'btn-primary' : 'btn-ghost';
  if (action.href) {
    return <Link to={action.href} className={base}>{action.label}</Link>;
  }
  return (
    <button onClick={action.onClick} className={base}>
      {action.label}
    </button>
  );
}

export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  secondaryAction,
  className = '',
  size = 'md',
}) {
  const s = SIZE[size] || SIZE.md;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${s.wrap} px-6 ${className}`}
      role="status"
      aria-label={title}
    >
      {/* Icon container */}
      <div
        className="flex items-center justify-center rounded-2xl mb-5"
        style={{
          width: s.icon * 2,
          height: s.icon * 2,
          background: 'color-mix(in srgb, var(--color-primary-500) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-primary-500) 20%, transparent)',
        }}
      >
        <Icon
          size={s.icon}
          style={{ color: 'var(--color-primary-400)' }}
          strokeWidth={1.5}
        />
      </div>

      {/* Text */}
      <h3 className={`font-semibold text-slate-800 ${s.title} mb-1`}>{title}</h3>
      {message && (
        <p className={`text-gray-500 max-w-xs leading-relaxed ${s.msg} mb-5`}>{message}</p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <ActionButton action={action} variant="primary" />
          <ActionButton action={secondaryAction} variant="ghost" />
        </div>
      )}
    </div>
  );
}


/**
 * Preset empty states for common pages — import directly for convenience.
 *
 * Usage: <EmptyStates.NoPhotos action={{ label: 'Upload', href: '/upload' }} />
 */

import {
  ImageOff, CalendarOff, SearchX, Bookmark, Camera,
  Bell, Users, ShieldOff,
} from 'lucide-react';

export const EmptyStates = {
  NoPhotos: (props) => (
    <EmptyState
      icon={ImageOff}
      title="No photos here yet"
      message="Photos uploaded to this event will appear here."
      {...props}
    />
  ),
  NoEvents: (props) => (
    <EmptyState
      icon={CalendarOff}
      title="No events found"
      message="Events will appear here once they're created."
      {...props}
    />
  ),
  NoResults: (props) => (
    <EmptyState
      icon={SearchX}
      title="No results found"
      message="Try adjusting your search or filters."
      {...props}
    />
  ),
  NoFavourites: (props) => (
    <EmptyState
      icon={Bookmark}
      title="Nothing saved yet"
      message="Tap the bookmark icon on any photo to save it here."
      action={{ label: 'Browse Events', href: '/events' }}
      {...props}
    />
  ),
  NoMyPhotos: (props) => (
    <EmptyState
      icon={Camera}
      title="Find yourself in every event"
      message="Upload a selfie and our AI will find all your photos across every event album."
      {...props}
    />
  ),
  NoNotifications: (props) => (
    <EmptyState
      icon={Bell}
      title="All caught up"
      message="You have no new notifications."
      size="sm"
      {...props}
    />
  ),
  NoUsers: (props) => (
    <EmptyState
      icon={Users}
      title="No users found"
      message="No users match the current filter."
      size="sm"
      {...props}
    />
  ),
  NoAccess: (props) => (
    <EmptyState
      icon={ShieldOff}
      title="Access restricted"
      message="You don't have permission to view this content."
      action={{ label: 'Request Access', href: '/request-access' }}
      {...props}
    />
  ),
};
