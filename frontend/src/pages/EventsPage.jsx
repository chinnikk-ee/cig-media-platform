import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Camera, Search, Plus, Lock, Calendar, Grid, List, SlidersHorizontal, ChevronDown, X, Image } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CATEGORIES = ['All','Photography','Workshop','Trip','Competition','Cultural Fest','Party','Sports','Other'];
const SORTS = [
  { value: 'created_at', label: 'Newest first' },
  { value: 'event_date', label: 'Event date' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'media_count', label: 'Most photos' },
];

function EventCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="bg-dark-700" style={{ aspectRatio: '3/2' }} />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-dark-600 rounded w-3/4" />
        <div className="h-3 bg-dark-700 rounded w-1/2" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 bg-dark-700 rounded-full w-16" />
          <div className="h-5 bg-dark-700 rounded-full w-20" />
        </div>
      </div>
    </div>
  );
}

function EventCardGrid({ event }) {
  const [hovering, setHovering] = useState(false);
  return (
    <Link
      to={`/events/${event.id}`}
      className="card overflow-hidden group transition-all duration-200 hover:border-primary-500/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 block"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="relative overflow-hidden bg-dark-700" style={{ aspectRatio: '3/2' }}>
        {event.cover_image ? (
          <img src={event.cover_image} alt={event.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={32} className="text-dark-500" />
          </div>
        )}
        {/* Bottom gradient — only over a real cover photo (keeps the chips legible);
            skipped on the empty placeholder so it doesn't darken the light card */}
        {event.cover_image && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
        )}
        {/* Photo count — bottom-left on image */}
        <div className="absolute bottom-2 left-2">
          <span className="flex items-center gap-1 text-xs font-medium text-white px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <Image size={10} />{event.media_count || 0}
          </span>
        </div>
        {/* Private chip — top-left */}
        {!event.is_public && (
          <div className="absolute top-2 left-2">
            <span className="flex items-center gap-1 text-xs font-medium text-yellow-300 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
              <Lock size={9} /> Private
            </span>
          </div>
        )}
        {/* Share button on hover — top-right */}
        <div className={`absolute top-2 right-2 transition-all duration-200 ${hovering ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`); toast.success('Link copied!'); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            title="Copy link"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-base leading-snug truncate">{event.name}</h3>
        {event.description && <p className="text-slate-500 text-sm mt-0.5 line-clamp-1">{event.description}</p>}
        <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-500 flex-wrap">
          {event.event_date && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />{format(new Date(event.event_date), 'MMM d, yyyy')}
            </span>
          )}
          {event.category && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-600/15 text-primary-600">
              {event.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function EventRowList({ event }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="card overflow-hidden group transition-all duration-150 hover:border-primary-500/40 flex gap-4 p-3 items-center"
    >
      <div className="relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-dark-700">
        {event.cover_image ? (
          <img src={event.cover_image} alt={event.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={18} className="text-dark-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm truncate">{event.name}</h3>
          {!event.is_public && <Lock size={11} className="text-yellow-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
          {event.event_date && (
            <span className="flex items-center gap-1"><Calendar size={10} />{format(new Date(event.event_date), 'MMM d, yyyy')}</span>
          )}
          <span className="flex items-center gap-1"><Image size={10} />{event.media_count || 0} photos</span>
          {event.category && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-600/15 text-primary-600">{event.category}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOpen, setSortOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('eventsView') || 'grid');
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const reqRef = useRef(0);
  const sortRef = useRef(null);

  const fetchEvents = async (reset = false) => {
    if (!reset && loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const pageToLoad = reset ? 1 : pageRef.current;
    const reqId = ++reqRef.current;
    try {
      const params = { sort_by: sortBy, page: pageToLoad, limit: 12 };
      if (search) params.search = search;
      if (category !== 'All') params.category = category;
      const res = await api.get('/events', { params });
      if (reqId !== reqRef.current) return;
      const newEvents = res.data.events || [];
      setEvents(prev => pageToLoad === 1 ? newEvents : [...prev, ...newEvents]);
      setHasMore(newEvents.length === 12);
      pageRef.current = pageToLoad + 1;
    } catch {
      if (reqId === reqRef.current) toast.error('Failed to load events');
    } finally {
      if (reqId === reqRef.current) { setLoading(false); loadingRef.current = false; }
    }
  };

  useEffect(() => { fetchEvents(true); }, [search, category, sortBy]);

  // Close sort popover on outside click
  useEffect(() => {
    const handler = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setView = (v) => { setViewMode(v); localStorage.setItem('eventsView', v); };
  const currentSort = SORTS.find(s => s.value === sortBy);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-slate-500 text-sm mt-0.5">Browse all event albums</p>
        </div>
        {user && ['admin','photographer','member'].includes(user.role) && (
          <Link to="/events/new" className="btn-primary">
            <Plus size={16} /> New Event
          </Link>
        )}
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm" placeholder="Search events…" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-900">
                <X size={13} />
              </button>
            )}
          </div>
          {/* Sort popover */}
          <div className="relative" ref={sortRef}>
            <button onClick={() => setSortOpen(o => !o)}
              className="btn-secondary gap-1.5 text-sm whitespace-nowrap">
              <SlidersHorizontal size={14} />
              {currentSort?.label}
              <ChevronDown size={12} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-30 py-1 overflow-hidden">
                {SORTS.map(s => (
                  <button key={s.value} onClick={() => { setSortBy(s.value); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${sortBy === s.value ? 'text-primary-600 bg-primary-600/10' : 'text-slate-600 hover:bg-dark-700'}`}>
                    {sortBy === s.value && <span className="mr-1.5">✓</span>}
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* View toggle */}
          <div className="flex border border-dark-600 rounded-lg overflow-hidden bg-dark-800">
            <button onClick={() => setView('grid')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-slate-900'}`} title="Grid view">
              <Grid size={15} />
            </button>
            <button onClick={() => setView('list')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-slate-900'}`} title="List view">
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Category pill chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                category === c
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-slate-500 hover:bg-dark-600 hover:text-slate-900 border border-dark-600'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton on first load */}
      {loading && events.length === 0 && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2'}>
          {Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && !loading && (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
            <Camera size={28} className="text-dark-500" />
          </div>
          <p className="text-slate-500 font-medium">No events found</p>
          <p className="text-gray-600 text-sm mt-1">Try a different search or category</p>
          {category !== 'All' && (
            <button onClick={() => setCategory('All')} className="btn-secondary text-sm mt-4">Clear filters</button>
          )}
        </div>
      )}

      {/* Grid / List */}
      {events.length > 0 && (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => <EventCardGrid key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map(event => <EventRowList key={event.id} event={event} />)}
          </div>
        )
      )}

      {/* Inline load-more spinner */}
      {loading && events.length > 0 && (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
        </div>
      )}

      {/* Load more button */}
      {!loading && hasMore && events.length > 0 && (
        <div className="flex justify-center">
          <button onClick={() => fetchEvents()} className="btn-secondary px-8 text-sm">Load more</button>
        </div>
      )}
    </div>
  );
}