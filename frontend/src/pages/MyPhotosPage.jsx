import { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import MediaCard from '../components/MediaCard';
import { Camera, Upload, Scan, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyPhotosPage() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState(user?.selfie_url || null);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/media/my-photos').then(res => setPhotos(res.data.photos || [])).finally(() => setLoading(false));
  }, []);

  const handleSelfieUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelfiePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('selfie', file);
      const res = await api.post('/media/selfie', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Selfie uploaded! Face matching will find your photos.');
      setSelfiePreview(res.data.selfie_url);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Scan size={24} className="text-primary-400" /> My Photos</h1>

      {/* Selfie upload card */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Camera size={18} /> Face Recognition Setup</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-dark-700 border-2 border-dark-500 overflow-hidden flex items-center justify-center">
              {selfiePreview ? (
                <img src={selfiePreview} alt="Your selfie" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-dark-400" />
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-3">
              Upload a clear selfie to automatically find photos of you from all events using AI facial recognition.
            </p>
            <button onClick={() => fileRef.current.click()} className="btn-primary text-sm" disabled={uploading}>
              <Upload size={16} /> {selfiePreview ? 'Update Selfie' : 'Upload Selfie'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSelfieUpload} />
          </div>
        </div>
      </div>

      {/* Matched photos */}
      <div>
        <h2 className="font-semibold mb-4">Photos You Appear In ({photos.length})</h2>
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Scan size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No photos found yet</p>
            <p className="text-sm mt-1">Upload a selfie and our AI will find photos of you from events</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map(m => m && <MediaCard key={m.id} media={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}
