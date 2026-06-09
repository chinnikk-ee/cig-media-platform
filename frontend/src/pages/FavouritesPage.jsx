import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import MediaCard from '../components/MediaCard';
import { Bookmark, CheckSquare, Trash2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

/* Group favourites by their event, preserving first-seen order. */
function groupByEvent(items) {
  const groups = [];
  const indexById = {};
  for (const m of items) {
    const key = m.event_id || m.event_name || 'ungrouped';
    if (indexById[key] == null) {
      indexById[key] = groups.length;
      groups.push({ key, eventId: m.event_id, eventName: m.event_name || 'Other', items: [] });
    }
    groups[indexById[key]].items.push(m);
  }
  return groups;
}

function FavSkeleton() {
  return (
    <div className="masonry-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="masonry-item skeleton-card" style={{ height: 140 + (i % 3) * 60 }} />
      ))}
    </div>
  );
}

export default function FavouritesPage() {
  const [favs, setFavs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    api.get('/social/favourites')
      .then(res => setFavs(res.data.favourites || []))
      .catch(() => toast.error('Failed to load favourites'))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const handleBulkRemove = async () => {
    setRemoving(true);
    const ids = [...selected];
    try {
      const results = await Promise.allSettled(ids.map(id => api.post('/social/favourite', { media_id: id })));
      const removedIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
      const failed = ids.length - removedIds.size;
      setFavs(prev => prev.filter(m => !removedIds.has(m.id)));
      if (failed === 0) toast.success(`${removedIds.size} removed from favourites`);
      else toast.error(`${removedIds.size} removed, ${failed} failed`);
    } catch {
      toast.error('Failed to remove favourites');
    } finally {
      setRemoving(false);
      exitSelectMode();
    }
  };

  const groups = groupByEvent(favs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Bookmark size={24} className="text-yellow-400" /> Favourites
          {favs.length > 0 && <span className="text-base font-normal text-gray-500">({favs.length})</span>}
        </h1>

        {favs.length > 0 && (
          selectMode ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-500">{selected.size} selected</span>
              {selected.size > 0 && (
                <button onClick={handleBulkRemove} disabled={removing}
                  className="btn bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50">
                  <Trash2 size={14} /> {removing ? 'Removing…' : `Remove ${selected.size}`}
                </button>
              )}
              <button onClick={exitSelectMode} className="text-sm text-gray-500 hover:text-slate-900 transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setSelectMode(true)} className="btn-secondary text-sm flex items-center gap-2">
              <CheckSquare size={15} /> Select
            </button>
          )
        )}
      </div>

      {loading ? (
        <FavSkeleton />
      ) : favs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-5">
            <Bookmark size={36} className="text-yellow-400/70" />
          </div>
          <h2 className="text-lg font-semibold">Nothing saved yet</h2>
          <p className="text-gray-500 text-sm mt-1 max-w-xs">
            Tap the bookmark on any photo to save it here for quick access later.
          </p>
          <Link to="/events" className="btn-primary mt-6">
            Browse Events <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <section key={group.key}>
              <div className="flex items-center justify-between mb-3">
                {group.eventId ? (
                  <Link to={`/events/${group.eventId}`}
                    className="section-label hover:text-primary-400 transition-colors flex items-center gap-1">
                    {group.eventName} <ArrowRight size={12} />
                  </Link>
                ) : (
                  <span className="section-label">{group.eventName}</span>
                )}
                <span className="text-xs text-gray-600">{group.items.length}</span>
              </div>
              <div className="masonry-grid">
                {group.items.map(m => (
                  <MediaCard
                    key={m.id}
                    media={m}
                    masonry
                    selectable={selectMode}
                    selected={selected.has(m.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
