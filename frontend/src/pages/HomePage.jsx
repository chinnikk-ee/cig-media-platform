import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import MediaCard from '../components/MediaCard';
import { ArrowRight, Camera, ScanFace } from 'lucide-react';
import { isToday, isYesterday, format } from 'date-fns';
import toast from 'react-hot-toast';

/* Count-up animation for a numeric target. Returns the current value. */
function useCountUp(target, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function StatItem({ label, target, fallback }) {
  const val = useCountUp(target ?? 0);
  const display = target == null
    ? fallback
    : target >= 1000 ? `${(val / 1000).toFixed(1)}K+` : `${val}+`;
  return (
    <div className="flex-1 px-5 py-4 text-center">
      <p className="text-2xl font-bold tracking-tight">{display}</p>
      <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

/* Group media into Today / Yesterday / date buckets, preserving order. */
function groupByDate(items) {
  const groups = [];
  const indexByLabel = {};
  for (const m of items) {
    const d = m.created_at ? new Date(m.created_at) : null;
    const label = !d || isNaN(d) ? 'Earlier'
      : isToday(d) ? 'Today'
      : isYesterday(d) ? 'Yesterday'
      : format(d, 'MMMM d, yyyy');
    if (indexByLabel[label] == null) {
      indexByLabel[label] = groups.length;
      groups.push({ label, items: [] });
    }
    groups[indexByLabel[label]].items.push(m);
  }
  return groups;
}

function HomeSkeleton() {
  return (
    <div className="space-y-10">
      <div className="skeleton-card h-56" />
      <div className="skeleton-card h-20" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-card h-56" />)}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/events?limit=6&sort_by=created_at'),
      api.get('/search?type=media&limit=12'),
      api.get('/admin/public-stats').catch(() => null),
    ]).then(([evRes, mediaRes, statsRes]) => {
      setEvents(evRes.data.events || []);
      setRecentMedia(mediaRes.data.results?.media || []);
      if (statsRes) setStats(statsRes.data.stats);
    }).catch(() => toast.error('Failed to load home feed')).finally(() => setLoading(false));
  }, []);

  if (loading) return <HomeSkeleton />;

  const isNew = (e) => e.created_at && (Date.now() - new Date(e.created_at).getTime()) < 48 * 3600 * 1000;
  const mosaic = events.map(e => e.cover_image).filter(Boolean).slice(0, 9);
  const photoGroups = groupByDate(recentMedia);

  const statMetrics = [
    { label: 'Photos Shared', target: stats?.photosShared, fallback: '10K+' },
    { label: 'Club Members', target: stats?.members, fallback: '500+' },
    { label: 'Events Covered', target: stats?.eventsCovered, fallback: '120+' },
  ];

  return (
    <div className="space-y-10">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-dark-600 bg-dark-800 px-6 py-10 md:px-12 md:py-16">
        {/* Thumbnail mosaic background */}
        {mosaic.length > 0 && (
          <div className="absolute inset-0 hidden sm:block" aria-hidden="true">
            <div
              className="absolute right-0 top-0 bottom-0 w-2/3 grid grid-cols-3 grid-rows-3 gap-1"
              style={{ filter: 'blur(2px)' }}
            >
              {mosaic.map((src, i) => (
                <img key={i} src={src} alt="" className="w-full h-full object-cover" />
              ))}
            </div>
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, #141417 28%, rgba(20,20,23,0.7) 55%, rgba(20,20,23,0.55))' }}
            />
          </div>
        )}

        <div className="relative z-10 max-w-xl">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3 md:mb-4 leading-tight">
            Your Club's <span className="text-primary-400">Media Hub</span>
          </h1>
          <p className="text-gray-300 text-sm md:text-lg mb-6 md:mb-8">
            Upload, organize, and share event photos. AI-powered tagging, facial recognition, and real-time collaboration.
          </p>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <Link to="/events" className="btn-primary px-5 md:px-6 py-2.5 md:py-3">
              Browse Events <ArrowRight size={16} />
            </Link>
            {user
              ? <Link to="/upload" className="btn-secondary px-5 md:px-6 py-2.5 md:py-3">Upload Photos</Link>
              : <Link to="/register" className="btn-secondary px-5 md:px-6 py-2.5 md:py-3">Get Started</Link>}
            <Link to="/my-photos" className="btn-ghost px-3 py-2.5 md:py-3 text-primary-400 hover:text-primary-300">
              <ScanFace size={16} /> Find my face
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats band ────────────────────────────────────────────────── */}
      <div className="card flex divide-x divide-dark-600">
        {statMetrics.map(m => <StatItem key={m.label} {...m} />)}
      </div>

      {/* ── Recent Events ─────────────────────────────────────────────── */}
      {events.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">Recent Events</h2>
            <Link to="/events" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <Link key={event.id} to={`/events/${event.id}`}
                className="card hover:border-primary-500/50 hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden block">
                <div className="relative bg-dark-700 overflow-hidden" style={{ aspectRatio: '3/2' }}>
                  {event.cover_image ? (
                    <img src={event.cover_image} alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera size={32} className="text-dark-500" />
                    </div>
                  )}
                  {isNew(event) && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-500 text-white shadow">
                      New
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate">{event.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{event.media_count || 0} media · {event.category || 'General'}</p>
                  {!event.is_public && <span className="badge bg-yellow-500/20 text-yellow-400 mt-2 inline-block">Private</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Photos (masonry, grouped by date) ──────────────────── */}
      {recentMedia.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">Recent Photos</h2>
            <Link to="/search" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              Browse all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-6">
            {photoGroups.map(group => (
              <div key={group.label}>
                <h3 className="section-label mb-3">{group.label}</h3>
                <div className="masonry-grid">
                  {group.items.map(m => <MediaCard key={m.id} media={m} masonry />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
