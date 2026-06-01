import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MediaCard from '../components/MediaCard';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [tags, setTags] = useState(params.get('tags') || '');
  const [results, setResults] = useState({ media: [], events: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('media');

  const doSearch = async () => {
    if (!query && !tags) return;
    setLoading(true);
    try {
      const res = await api.get('/search', { params: { q: query, tags, type: 'all' } });
      setResults(res.data.results || {});
    } finally { setLoading(false); }
  };

  useEffect(() => { if (query || tags) doSearch(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="input pl-9" placeholder="Search events, photos, users..." />
        </div>
        <input value={tags} onChange={e => setTags(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
          className="input w-48" placeholder="Tags (comma separated)" />
        <button onClick={doSearch} className="btn-primary">Search</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-600 gap-1">
        {[['media','Photos'], ['events','Events'], ['users','Users']].map(([k, label]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px
              ${activeTab === k ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {label} {results[k]?.length > 0 && `(${results[k].length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
      ) : activeTab === 'media' ? (
        results.media?.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.media.map(m => <MediaCard key={m.id} media={m} />)}
          </div>
        ) : <p className="text-gray-500 text-center py-10">No photos found</p>
      ) : activeTab === 'events' ? (
        results.events?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.events.map(e => (
              <a key={e.id} href={`/events/${e.id}`} className="card p-4 hover:border-primary-500/50 transition-all">
                <h3 className="font-semibold">{e.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{e.category} · {e.media_count} photos</p>
              </a>
            ))}
          </div>
        ) : <p className="text-gray-500 text-center py-10">No events found</p>
      ) : (
        results.users?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.users.map(u => (
              <div key={u.id} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-semibold">
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">@{u.username}</p>
                  <p className="text-sm text-gray-400 capitalize">{u.role}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-center py-10">No users found</p>
      )}
    </div>
  );
}
