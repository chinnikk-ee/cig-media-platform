import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MediaCard from '../components/MediaCard';
import { Camera, Upload, Scan, User, ScanFace, Images, ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

/* Group matched photos by event, preserving confidence order. */
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

const STEPS = [
  { icon: Upload, title: 'Upload a selfie', desc: 'A clear, front-facing photo works best.' },
  { icon: ScanFace, title: 'AI scans events', desc: 'We compare your face against every photo.' },
  { icon: Images, title: 'See your photos', desc: 'Every shot you appear in, in one place.' },
];

export default function MyPhotosPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState(user?.selfie_url || null);
  const fileRef = useRef();

  const fetchPhotos = useCallback(() => {
    return api.get('/media/my-photos')
      .then(res => setPhotos(res.data.photos || []))
      .catch(() => toast.error('Failed to load your photos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  useEffect(() => {
    if (!socket) return;
    const onStarted = () => setScanning(true);
    const onComplete = ({ count } = {}) => {
      setScanning(false);
      fetchPhotos().then(() => {
        if (count > 0) toast.success(`Found ${count} photo${count === 1 ? '' : 's'} of you!`);
      });
    };
    socket.on('face_match_started', onStarted);
    socket.on('face_match_complete', onComplete);
    return () => {
      socket.off('face_match_started', onStarted);
      socket.off('face_match_complete', onComplete);
    };
  }, [socket, fetchPhotos]);

  const handleSelfieUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelfiePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('selfie', file);
      const res = await api.post('/media/selfie', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Selfie uploaded! Scanning photos for your face…');
      setScanning(true);
      setSelfiePreview(res.data.selfie_url);
    } catch (err) {
      setSelfiePreview(user?.selfie_url || null);
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const openPicker = () => fileRef.current?.click();
  const confidenceChip = (c) => {
    if (c == null) return null;
    const high = c >= 90;
    return (
      <span className={`badge text-white backdrop-blur-sm ${high ? 'bg-green-600/80' : 'bg-yellow-600/80'}`}>
        {high ? 'High' : 'Medium'} match
      </span>
    );
  };

  const groups = groupByEvent(photos);

  // ── Onboarding (no selfie yet) ──────────────────────────────────────
  if (!selfiePreview && !loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSelfieUpload} />
        <div className="text-center py-10">
          {/* Circular drop zone with face silhouette hint */}
          <button onClick={openPicker} disabled={uploading}
            className="group mx-auto w-40 h-40 rounded-full border-2 border-dashed border-dark-500 hover:border-primary-500 bg-dark-800 flex flex-col items-center justify-center transition-all relative">
            {uploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
            ) : (
              <>
                <User size={56} className="text-dark-500 group-hover:text-primary-400 transition-colors" strokeWidth={1.25} />
                <span className="absolute bottom-7 flex items-center gap-1 text-xs text-gray-500 group-hover:text-primary-400 transition-colors">
                  <Upload size={11} /> Selfie
                </span>
              </>
            )}
          </button>

          <h1 className="text-2xl font-bold mt-6">Find yourself in every event</h1>
          <p className="text-gray-400 mt-2 max-w-md mx-auto">
            Upload a selfie and our AI facial recognition will surface every photo you appear in across all events.
          </p>
          <button onClick={openPicker} disabled={uploading} className="btn-primary mt-6">
            <Upload size={16} /> {uploading ? 'Uploading…' : 'Upload selfie'}
          </button>

          {/* 3-step explainer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <s.icon size={16} className="text-primary-400" />
                </div>
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Results / setup-with-selfie state ──────────────────────────────
  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSelfieUpload} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Scan size={24} className="text-primary-400" /> My Photos
        </h1>
        {/* Selfie thumb + update */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-dark-700 border border-dark-500 relative flex-shrink-0">
            {selfiePreview
              ? <img src={selfiePreview} alt="Your selfie" className="w-full h-full object-cover" />
              : <User size={18} className="text-dark-400 absolute inset-0 m-auto" />}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              </div>
            )}
          </div>
          <button onClick={openPicker} disabled={uploading} className="btn-secondary text-sm">
            <RefreshCw size={14} /> Update selfie
          </button>
        </div>
      </div>

      {/* Scanning banner */}
      {scanning && (
        <div className="card p-4 flex items-center gap-3">
          <ScanFace size={18} className="text-primary-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Scanning events for your face…</p>
            <div className="mt-2 h-1.5 rounded-full bg-dark-700 overflow-hidden">
              <div className="h-full w-1/3 bg-primary-500 rounded-full animate-pulse" style={{ animation: 'shimmer 1.4s infinite linear' }} />
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-4">Photos You Appear In ({photos.length})</h2>

        {loading ? (
          <div className="masonry-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="masonry-item skeleton-card" style={{ height: 140 + (i % 3) * 60 }} />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Scan size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{scanning ? 'Scanning in progress…' : 'No photos found yet'}</p>
            <p className="text-sm mt-1">
              {scanning ? 'Results will appear here automatically.' : 'Try updating your selfie with a clearer, front-facing photo.'}
            </p>
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
                  {group.items.map(m => m && (
                    <MediaCard key={m.id} media={m} masonry badge={confidenceChip(m.confidence)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
