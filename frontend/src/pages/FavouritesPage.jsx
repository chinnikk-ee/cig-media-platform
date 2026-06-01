import { useEffect, useState } from 'react';
import api from '../utils/api';
import MediaCard from '../components/MediaCard';
import { Heart } from 'lucide-react';

export default function FavouritesPage() {
  const [favs, setFavs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/social/favourites').then(res => setFavs(res.data.favourites || [])).finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Heart size={24} className="text-yellow-400" /> Favourites</h1>
      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
        : favs.length === 0 ? <p className="text-gray-500 text-center py-10">No favourites yet</p>
        : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{favs.map(m => <MediaCard key={m.id} media={m} />)}</div>}
    </div>
  );
}
