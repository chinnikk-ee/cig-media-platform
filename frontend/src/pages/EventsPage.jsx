import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Camera, Search, Plus, Lock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CATEGORIES = ['All','Photography','Workshop','Trip','Competition','Cultural Fest','Party','Sports','Other'];
const SORTS = [
  { value: 'created_at', label: 'Newest' },
  { value: 'event_date', label: 'Event Date' },
  { value: 'name', label: 'Name' },
  { value: 'media_count', label: 'Most Photos' },
];

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = async (reset = false) => {
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const params = { sort_by: sortBy, page: p, limit: 12 };
      if (search) params.search = search;
      if (category !== 'All') params.category = category;

      const res = await api.get('/events', { params });
      const newEvents = res.data.events || [];
      setEvents(reset ? newEvents : prev => [...prev, ...newEvents]);
      setHasMore(newEvents.length === 12);
      if (!reset) setPage(p + 1);
    } catch { toast.error('Failed to load events'); } finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); fetchEvents(true); }, [search, category, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-gray-400 mt-1">Browse all event albums</p>
        </div>
        {user && ['admin','photographer','member'].includes(user.role) && (
          <Link to="/events/new" className="btn-primary">
            <Plus size={18} /> New Event
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9" placeholder="Search events..." />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="input md:w-48">
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input md:w-44">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {events.length === 0 && !loading ? (
        <div className="text-center py-20 text-gray-500">
          <Camera size={40} className="mx-auto mb-3 opacity-30" />
          <p>No events found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(event => (
            <Link key={event.id} to={`/events/${event.id}`}
              className="card hover:border-primary-500/50 transition-all group overflow-hidden">
              <div className="aspect-video bg-dark-700 overflow-hidden">
                {event.cover_image ? (
                  <img src={event.cover_image} alt={event.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera size={36} className="text-dark-500" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg leading-tight">{event.name}</h3>
                  {!event.is_public && <Lock size={14} className="text-yellow-400 flex-shrink-0 mt-1" />}
                </div>
                {event.description && <p className="text-gray-400 text-sm mt-1 line-clamp-2">{event.description}</p>}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Camera size={13} /> {event.media_count || 0} photos</span>
                  {event.event_date && (
                    <span className="flex items-center gap-1"><Calendar size={13} />
                      {format(new Date(event.event_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                {event.category && (
                  <span className="badge bg-primary-600/20 text-primary-400 mt-3 inline-block">{event.category}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      )}

      {!loading && hasMore && events.length > 0 && (
        <div className="flex justify-center">
          <button onClick={() => fetchEvents()} className="btn-secondary px-8">Load more</button>
        </div>
      )}
    </div>
  );
}
