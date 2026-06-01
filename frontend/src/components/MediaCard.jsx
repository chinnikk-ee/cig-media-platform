import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Download, Bookmark, Play } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function MediaCard({ media, onUpdate }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(media.is_liked);
  const [likeCount, setLikeCount] = useState(Number(media.like_count) || 0);
  const [faved, setFaved] = useState(media.is_favourited);

  const handleLike = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Login to like photos');
    try {
      const res = await api.post('/social/like', { media_id: media.id });
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch { toast.error('Failed'); }
  };

  const handleFav = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Login to favourite photos');
    try {
      const res = await api.post('/social/favourite', { media_id: media.id });
      setFaved(res.data.favourited);
      toast.success(res.data.favourited ? 'Added to favourites' : 'Removed from favourites');
    } catch { toast.error('Failed'); }
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    try {
      const response = await api.get(`/media/${media.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `cig-${media.file_name || media.id}.jpg`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="group relative card overflow-hidden hover:border-primary-500/50 transition-all duration-300">
      <Link to={`/media/${media.id}`}>
        <div className="relative aspect-square overflow-hidden bg-dark-700">
          {media.media_type === 'video' ? (
            <div className="relative w-full h-full">
              <img src={media.thumbnail_url || media.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                  <Play size={20} className="text-white ml-1" />
                </div>
              </div>
            </div>
          ) : (
            <img src={media.thumbnail_url || media.url} alt={media.file_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy" />
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              {media.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {media.ai_tags.slice(0, 3).map(tag => (
                    <span key={tag} className="badge bg-black/50 text-gray-200 text-[10px]">#{tag}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-300 truncate">{media.event_name}</p>
            </div>
          </div>
        </div>
      </Link>

      {/* Actions */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-all ${liked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            <span>{likeCount}</span>
          </button>
          <Link to={`/media/${media.id}`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-all">
            <MessageCircle size={16} />
            <span>{media.comment_count || 0}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleFav} className={`transition-all ${faved ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}>
            <Bookmark size={16} fill={faved ? 'currentColor' : 'none'} />
          </button>
          <button onClick={handleDownload} className="text-gray-400 hover:text-white transition-all">
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
