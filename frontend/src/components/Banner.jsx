/**
 * Banner
 * ──────
 * Full-bleed cover banner with dark gradient overlay and floating content.
 * Shared between EventDetailPage and ProfilePage.
 *
 * Props:
 *   src          — image URL (required)
 *   alt          — img alt text
 *   height       — banner height in px (default 280)
 *   children     — content that floats over the gradient (title, meta, badges)
 *   actions      — optional node rendered in the top-right corner
 *   fallbackColor — bg color shown when src is missing/loading (default dark-700)
 *   className    — extra classes on the root
 *   overlay      — gradient opacity 0–1 (default 0.65)
 */

export default function Banner({
  src,
  alt = '',
  height = 280,
  children,
  actions,
  fallbackColor,
  className = '',
  overlay = 0.65,
}) {
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height, background: fallbackColor || 'var(--color-dark-700)' }}
    >
      {/* Cover image */}
      {src && (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Dark gradient overlay — bottom-heavy so text is always legible */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(0,0,0,${overlay * 0.3}) 0%,
            rgba(0,0,0,${overlay * 0.5}) 40%,
            rgba(0,0,0,${overlay}) 100%
          )`,
        }}
        aria-hidden="true"
      />

      {/* Top-right actions (share, edit, etc.) */}
      {actions && (
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {actions}
        </div>
      )}

      {/* Bottom content (title, date, badges) */}
      {children && (
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {children}
        </div>
      )}
    </div>
  );
}


/**
 * BannerSkeleton — drop-in placeholder while the banner image loads
 */
export function BannerSkeleton({ height = 280 }) {
  return (
    <div
      className="skeleton-card w-full"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
