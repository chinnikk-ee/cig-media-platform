import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Download, Bookmark, Play } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/**
 * MediaCard
 * ─────────
 * Two variants:
 *   - Default (square): used in uniform grids
 *   - masonry: used inside .masonry-grid — no fixed aspect ratio,
 *     natural image height so images don't get cropped
 *
 * Props:
 *   media      — media object from API
 *   masonry    — boolean, enables natural-height mode
 *   onUpdate   — optional callback after like/fav changes
 */
export default function MediaCard({ media, masonry = false, onUpdate }) {
  const { user } = useAuth();
  const [liked,     setLiked]     = useState(media.is_liked);
  const [likeCount, setLikeCount] = useState(Number(media.like_count) || 0);
  const [faved,     setFaved]     = useState(media.is_favourited);

  const handleLike = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Login to like photos');
    try {
      const res = await api.post('/social/like', { media_id: media.id });
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
      onUpdate?.({ liked: res.data.liked, likeCount: res.data.like_count });
    } catch { toast.error('Failed to like'); }
  };

  const handleFav = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Login to save photos');
    try {
      const res = await api.post('/social/favourite', { media_id: media.id });
      setFaved(res.data.favourited);
      toast.success(res.data.favourited ? 'Saved to favourites' : 'Removed from favourites');
      onUpdate?.({ faved: res.data.favourited });
    } catch { toast.error('Failed'); }
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    try {
      const res = await api.get(`/media/${media.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `cig-${media.file_name || media.id}.jpg`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const isVideo = media.media_type === 'video';

  return (
    <div className={`group relative card overflow-hidden transition-all duration-200 hover:border-primary-500/40 ${masonry ? 'masonry-item' : ''}`}>

      {/* ── Image / Video ──────────────────────────────────────────────── */}
      <Link to={`/media/${media.id}`} className="block">
        <div
          className={`relative overflow-hidden bg-dark-700 ${masonry ? '' : 'aspect-square'}`}
        >
          <img
            src={media.thumbnail_url || media.url}
            alt={media.file_name || 'Photo'}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            style={masonry ? { display: 'block' } : { height: '100%' }}
            loading="lazy"
          />

          {/* Video play button */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-black/55 flex items-center justify-center
                              transition-transform duration-150 group-hover:scale-110">
                <Play size={18} className="text-white ml-0.5" />
              </div>
            </div>
          )}

          {/* Hover overlay — tags + event name */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}
            aria-hidden="true"
          >
            <div className="absolute bottom-0 left-0 right-0 p-3">
              {/* AI tag chips */}
              {media.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {media.ai_tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.5)', color: '#d1d5db' }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Event name */}
              {media.event_name && (
                <p className="text-xs text-gray-300 truncate leading-tight">{media.event_name}</p>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ── Action bar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2">

        {/* Left: like + comment */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs font-medium transition-all duration-150
              ${liked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} strokeWidth={liked ? 0 : 1.75} />
            <span>{likeCount}</span>
          </button>

          <Link
            to={`/media/${media.id}`}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-white transition-all"
            aria-label="View comments"
          >
            <MessageCircle size={15} strokeWidth={1.75} />
            <span>{media.comment_count || 0}</span>
          </Link>
        </div>

        {/* Right: save + download */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFav}
            className={`icon-btn w-7 h-7 transition-all duration-150
              ${faved ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}`}
            aria-label={faved ? 'Remove from favourites' : 'Save to favourites'}
          >
            <Bookmark size={14} fill={faved ? 'currentColor' : 'none'} strokeWidth={faved ? 0 : 1.75} />
          </button>

          <button
            onClick={handleDownload}
            className="icon-btn w-7 h-7 text-gray-500 hover:text-white"
            aria-label="Download"
          >
            <Download size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
