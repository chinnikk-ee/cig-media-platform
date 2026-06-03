import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import MediaCard from '../components/MediaCard';
import { ArrowRight, Camera, Users, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/events?limit=6&sort_by=created_at'),
      api.get('/search?type=media&limit=8'),
      api.get('/admin/public-stats').catch(() => null),
    ]).then(([evRes, mediaRes, statsRes]) => {
      setEvents(evRes.data.events || []);
      setRecentMedia(mediaRes.data.results?.media || []);
      if (statsRes) setStats(statsRes.data.stats);
    }).catch(() => toast.error('Failed to load home feed')).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900/50 via-dark-800 to-dark-800 border border-dark-600 p-8 md:p-12">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Your Club's <span className="text-primary-400">Media Hub</span>
          </h1>
          <p className="text-gray-300 text-lg mb-8 max-w-xl">
            Upload, organize, and share event photos. AI-powered tagging, facial recognition, and real-time collaboration.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/events" className="btn-primary px-6 py-3">Browse Events <ArrowRight size={16} /></Link>
            {user && <Link to="/upload" className="btn-secondary px-6 py-3">Upload Photos</Link>}
            {!user && <Link to="/register" className="btn-secondary px-6 py-3">Get Started</Link>}
          </div>
        </div>
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 right-32 w-32 h-32 bg-primary-600/5 rounded-full translate-y-1/2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Camera, label: 'Photos Shared', value: stats ? (stats.photosShared >= 1000 ? `${(stats.photosShared / 1000).toFixed(1)}K+` : `${stats.photosShared}+`) : '10K+' },
          { icon: Users, label: 'Club Members', value: stats ? `${stats.members}+` : '500+' },
          { icon: Zap, label: 'Events Covered', value: stats ? `${stats.eventsCovered}+` : '120+' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card p-6 text-center">
            <Icon size={24} className="text-primary-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      {events.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent Events</h2>
            <Link to="/events" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <Link key={event.id} to={`/events/${event.id}`}
                className="card hover:border-primary-500/50 transition-all group overflow-hidden">
                <div className="aspect-video bg-dark-700 overflow-hidden">
                  {event.cover_image ? (
                    <img src={event.cover_image} alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera size={32} className="text-dark-500" />
                    </div>
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

      {/* Recent Photos */}
      {recentMedia.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent Photos</h2>
            <Link to="/search" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              Browse all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentMedia.map(m => <MediaCard key={m.id} media={m} />)}
          </div>
        </section>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      )}
    </div>
  );
}