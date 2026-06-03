/**
 * MasonryGrid
 * ───────────
 * CSS-columns masonry wrapper. Drop any children in — they break
 * into natural-height columns without a JS layout library.
 *
 * Props:
 *   children   — media cards or any elements
 *   cols       — override column count object: { sm, md, lg, xl }
 *                defaults: { sm: 2, md: 3, lg: 3, xl: 4 }
 *   gap        — gap between items in px (default 12)
 *   className  — extra classes on the wrapper
 *   loading    — if true, renders SkeletonGrid instead
 *   skeletonCount — number of skeleton cards to show while loading
 *
 * Usage:
 *   <MasonryGrid loading={isLoading}>
 *     {mediaItems.map(m => <MediaCard key={m.id} media={m} masonry />)}
 *   </MasonryGrid>
 */

import { SkeletonGrid } from './Skeleton';

export default function MasonryGrid({
  children,
  cols = {},
  gap = 12,
  className = '',
  loading = false,
  skeletonCount = 12,
}) {
  if (loading) {
    return <SkeletonGrid count={skeletonCount} masonry className={className} />;
  }

  // Build responsive column style via inline CSS vars
  // (CSS columns can't use Tailwind responsive breakpoints directly in className)
  const { sm = 2, md = 3, lg = 3, xl = 4 } = cols;

  return (
    <>
      <style>{`
        .masonry-custom { columns: ${sm}; column-gap: ${gap}px; }
        @media (min-width: 768px)  { .masonry-custom { columns: ${md}; } }
        @media (min-width: 1024px) { .masonry-custom { columns: ${lg}; } }
        @media (min-width: 1280px) { .masonry-custom { columns: ${xl}; } }
        .masonry-custom > * { break-inside: avoid; margin-bottom: ${gap}px; }
      `}</style>
      <div className={`masonry-custom ${className}`}>
        {children}
      </div>
    </>
  );
}
