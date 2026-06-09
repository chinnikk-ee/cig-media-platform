import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MediaCard from '../components/MediaCard';
import { Search, CalendarDays, X, Clock, Hash, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const RECENT_KEY = 'recentSearches';
const loadRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [tagList, setTagList] = useState(
    (params.get('tags') || '').split(',').map(t => t.trim()).filter(Boolean)
  );
  const [startDate, setStartDate] = useState(params.get('start_date') || '');
  const [endDate, setEndDate] = useState(params.get('end_date') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState({ media: [], events: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('media');
  const [recent, setRecent] = useState(loadRecent);
  const [showSuggest, setShowSuggest] = useState(false);
  const inputRef = useRef(null);

  const hasDateFilter = startDate || endDate;

  const saveRecent = (q) => {
    const term = q.trim();
    if (!term) return;
    const next = [term, ...recent.filter(r => r !== term)].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const doSearch = async (overrides = {}) => {
    const q = overrides.query ?? query;
    const tags = overrides.tagList ?? tagList;
    if (!q && !tags.length && !startDate && !endDate) return;
    setShowSuggest(false);
    setLoading(true);
    setSearched(true);
    saveRecent(q);
    setParams({
      ...(q ? { q } : {}),
      ...(tags.length ? { tags: tags.join(',') } : {}),
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    });
    try {
      const res = await api.get('/search', {
        params: {
          q: q || undefined,
          tags: tags.length ? tags.join(',') : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          type: 'all',
        },
      });
      setResults(res.data.results || {});
    } catch { toast.error('Search failed'); } finally {
      setLoading(false);
    }
  };

  const addTag = (raw) => {
    const t = raw.replace(/^#/, '').trim();
    if (t && !tagList.includes(t)) setTagList([...tagList, t]);
  };
  const removeTag = (t) => setTagList(tagList.filter(x => x !== t));

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (query.startsWith('#') && query.length > 1) {
        addTag(query);
        setQuery('');
      } else {
        doSearch();
      }
    } else if (e.key === 'Backspace' && !query && tagList.length) {
      removeTag(tagList[tagList.length - 1]);
    }
  };

  const clearDates = () => { setStartDate(''); setEndDate(''); };

  useEffect(() => {
    if (query || tagList.length || startDate || endDate) doSearch();
    else inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = {
    media: results.media?.length || 0,
    events: results.events?.length || 0,
    users: results.users?.length || 0,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Search</h1>

      {/* Prominent search bar with inline tag chips */}
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="flex items-center flex-wrap gap-1.5 input py-2.5 pl-9 pr-3 focus-within:border-primary-500"
              onClick={() => inputRef.current?.focus()}>
              <Search size={17} className="absolute left-3 top-3.5 text-slate-500" />
              {tagList.map(t => (
                <span key={t} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary-600/20 text-primary-700">
                  <Hash size={10} />{t}
                  <button onClick={(e) => { e.stopPropagation(); removeTag(t); }} className="hover:text-slate-900">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder-gray-500"
                placeholder={tagList.length ? 'Add more…  (#tag to filter)' : 'Search photos, events, people…  (#tag to filter)'}
              />
            </div>

            {/* Recent searches typeahead */}
            {showSuggest && !query && recent.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 card z-20 py-1 overflow-hidden">
                <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-600">Recent</p>
                {recent.map(r => (
                  <button key={r} onMouseDown={() => { setQuery(r); doSearch({ query: r }); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-dark-700 text-left">
                    <Clock size={13} className="text-gray-500" /> {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary flex items-center gap-2 relative ${showFilters ? 'text-primary-400' : ''}`}
            title="Date filters">
            <CalendarDays size={16} />
            <span className="hidden sm:inline">Date</span>
            {hasDateFilter && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary-500" />}
          </button>
          <button onClick={() => doSearch()} className="btn-primary">Search</button>
        </div>

        {/* Date filter panel */}
        {showFilters && (
          <div className="card p-4 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <CalendarDays size={15} className="text-primary-400" /> Filter by date
            </div>
            <div className="flex flex-wrap gap-4 flex-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="input text-sm" style={{ colorScheme: 'dark' }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">To</label>
                <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)}
                  className="input text-sm" style={{ colorScheme: 'dark' }} />
              </div>
            </div>
            {hasDateFilter && (
              <button onClick={clearDates} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors">
                <X size={13} /> Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs with counts */}
      <div className="flex border-b border-dark-600 gap-1">
        {[['media', 'Photos'], ['events', 'Events'], ['users', 'People']].map(([k, label]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px
              ${activeTab === k ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
            {label}{searched && <span className="ml-1 text-gray-500">({counts[k]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="masonry-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="masonry-item skeleton-card" style={{ height: 140 + (i % 3) * 60 }} />
          ))}
        </div>
      ) : activeTab === 'media' ? (
        counts.media > 0 ? (
          <div className="masonry-grid">
            {results.media.map(m => <MediaCard key={m.id} media={m} masonry />)}
          </div>
        ) : <p className="text-gray-500 text-center py-10">{searched ? 'No photos found' : 'Search to see photos'}</p>
      ) : activeTab === 'events' ? (
        counts.events > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.events.map(e => (
              <Link key={e.id} to={`/events/${e.id}`} className="card p-4 hover:border-primary-500/50 transition-all">
                <h3 className="font-semibold">{e.name}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {e.category} · {e.media_count} media
                  {e.event_date && <span className="ml-2">· {new Date(e.event_date).toLocaleDateString()}</span>}
                </p>
              </Link>
            ))}
          </div>
        ) : <p className="text-gray-500 text-center py-10">{searched ? 'No events found' : 'Search to see events'}</p>
      ) : (
        counts.users > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.users.map(u => (
              <div key={u.id} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-semibold text-white">
                  {u.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">@{u.username}</p>
                  <p className="text-sm text-slate-500 capitalize">{u.role}</p>
                </div>
                {(u.media_count != null || u.photo_count != null) && (
                  <span className="flex items-center gap-1 text-xs text-slate-500 badge bg-dark-700">
                    <ImageIcon size={11} /> {u.media_count ?? u.photo_count}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-center py-10">{searched ? 'No people found' : 'Search to see people'}</p>
      )}
    </div>
  );
}
