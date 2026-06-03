/**
 * Skeleton
 * ────────
 * Reusable shimmer placeholder shapes.
 * Use these instead of hand-writing shimmer divs in every page.
 *
 * Exports:
 *   SkeletonText       — single line of text
 *   SkeletonBlock      — generic rectangle (specify w/h via className)
 *   SkeletonRound      — circle (avatar, icon)
 *   SkeletonCard       — full media card placeholder
 *   SkeletonEventCard  — event album card placeholder
 *   SkeletonGrid       — n-up grid of SkeletonCards
 *   SkeletonList       — n rows of avatar + two text lines
 */

/* ── Base shimmer div ───────────────────────────────────────────────────── */
function Shimmer({ className = '', style = {} }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/* ── Single text line ───────────────────────────────────────────────────── */
export function SkeletonText({ className = '' }) {
  return <Shimmer className={`skeleton-text ${className}`} />;
}

/* ── Generic block ──────────────────────────────────────────────────────── */
export function SkeletonBlock({ className = '', style = {} }) {
  return <Shimmer className={`skeleton-card ${className}`} style={style} />;
}

/* ── Circle (avatar / icon) ─────────────────────────────────────────────── */
export function SkeletonRound({ size = 40, className = '' }) {
  return (
    <Shimmer
      className={`skeleton-round flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/* ── Media card placeholder ─────────────────────────────────────────────── */
export function SkeletonCard({ masonry = false }) {
  // Random-ish height for masonry so it looks natural
  const heights = [160, 200, 240, 180, 220];
  const h = masonry ? heights[Math.floor(Math.random() * heights.length)] : null;

  return (
    <div className={`card overflow-hidden ${masonry ? 'masonry-item' : ''}`} aria-hidden="true">
      <Shimmer
        className="w-full skeleton-card rounded-none"
        style={{ height: masonry ? h : undefined, aspectRatio: masonry ? undefined : '1 / 1' }}
      />
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <Shimmer className="skeleton-round" style={{ width: 28, height: 16, borderRadius: 999 }} />
          <Shimmer className="skeleton-round" style={{ width: 28, height: 16, borderRadius: 999 }} />
        </div>
        <div className="flex gap-2">
          <Shimmer className="skeleton-round" style={{ width: 16, height: 16, borderRadius: 999 }} />
          <Shimmer className="skeleton-round" style={{ width: 16, height: 16, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

/* ── Event card placeholder ─────────────────────────────────────────────── */
export function SkeletonEventCard() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <Shimmer className="w-full skeleton-card rounded-none" style={{ aspectRatio: '3 / 2' }} />
      <div className="p-4 space-y-2">
        <SkeletonText className="w-3/4" />
        <SkeletonText className="w-1/2" />
        <div className="flex gap-2 pt-1">
          <Shimmer className="skeleton-round" style={{ width: 48, height: 18, borderRadius: 999 }} />
          <Shimmer className="skeleton-round" style={{ width: 36, height: 18, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

/* ── Grid of n media cards ──────────────────────────────────────────────── */
export function SkeletonGrid({ count = 6, masonry = false, className = '' }) {
  if (masonry) {
    return (
      <div className={`masonry-grid ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} masonry />
        ))}
      </div>
    );
  }
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ── List rows (avatar + 2 text lines) ──────────────────────────────────── */
export function SkeletonList({ count = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" aria-hidden="true">
          <SkeletonRound size={36} />
          <div className="flex-1 space-y-1.5">
            <SkeletonText className="w-1/3" />
            <SkeletonText className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Stats row ──────────────────────────────────────────────────────────── */
export function SkeletonStats({ count = 3, className = '' }) {
  return (
    <div className={`grid gap-3 ${className}`} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2" aria-hidden="true">
          <SkeletonRound size={32} />
          <SkeletonText className="w-1/2" />
          <SkeletonText className="w-2/3" />
        </div>
      ))}
    </div>
  );
}

/* Default export: all named exports collected */
export default {
  Text:      SkeletonText,
  Block:     SkeletonBlock,
  Round:     SkeletonRound,
  Card:      SkeletonCard,
  EventCard: SkeletonEventCard,
  Grid:      SkeletonGrid,
  List:      SkeletonList,
  Stats:     SkeletonStats,
};
