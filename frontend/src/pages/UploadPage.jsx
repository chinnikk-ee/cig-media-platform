import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import { Upload, X, CheckCircle, AlertCircle, Image } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    api.get('/events?limit=50').then(res => setEvents(res.data.events || []));
  }, []);

  const onDrop = useCallback(accepted => {
    const mapped = accepted.map(f => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      status: 'pending',
    }));
    setFiles(prev => { const combined = [...prev, ...mapped]; if (combined.length > 50) { toast.error('Max 50 files at once'); return combined.slice(0, 50); } return combined; });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'video/*': [] }, multiple: true, maxFiles: 50,
  });

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const selectedEventObj = events.find(ev => ev.id === selectedEvent);
  const isPrivateEvent = selectedEventObj && !selectedEventObj.is_public;

  const handleUpload = async () => {
    if (!selectedEvent) return toast.error('Please select an event');
    if (files.length === 0) return toast.error('Please add files');

    setUploading(true);
    const formData = new FormData();
    formData.append('event_id', selectedEvent);
    // Private events force media private; only public events honour the toggle.
    formData.append('is_public', isPrivateEvent ? false : isPublic);
    files.forEach(f => formData.append('files', f.file));

    try {
      await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress({ overall: pct });
        },
      });
      toast.success(`${files.length} file(s) uploaded!`);
      setFiles([]);
      setProgress({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Media</h1>
        <p className="text-gray-400 mt-1">Upload photos and videos to an event album</p>
      </div>

      {/* Event selector */}
      <div className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Select Event *</label>
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="input">
            <option value="">Choose an event...</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        {isPrivateEvent ? (
          <p className="text-sm text-gray-400">
            🔒 This is a private event — all uploaded media will be private.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsPublic(!isPublic)}
              className={`relative w-10 h-6 rounded-full transition-all ${isPublic ? 'bg-primary-600' : 'bg-dark-600'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPublic ? 'left-5' : 'left-1'}`} />
            </button>
            <span className="text-sm text-gray-300">{isPublic ? 'Public media' : 'Private media'}</span>
          </div>
        )}
      </div>

      {/* Dropzone */}
      <div {...getRootProps()}
        className={`card p-10 text-center cursor-pointer border-2 border-dashed transition-all
          ${isDragActive ? 'border-primary-500 bg-primary-600/10' : 'border-dark-500 hover:border-primary-500/50'}`}>
        <input {...getInputProps()} />
        <Upload size={40} className={`mx-auto mb-4 ${isDragActive ? 'text-primary-400' : 'text-gray-500'}`} />
        {isDragActive ? (
          <p className="text-primary-400 font-medium">Drop files here</p>
        ) : (
          <>
            <p className="text-gray-300 font-medium">Drag & drop photos or videos here</p>
            <p className="text-gray-500 text-sm mt-2">or click to browse · Max 100MB per file · Up to 50 files at once</p>
          </>
        )}
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{files.length} file(s) selected</h3>
            <button onClick={() => setFiles([])} className="text-sm text-gray-400 hover:text-red-400">Clear all</button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {files.map(f => (
              <div key={f.id} className="relative group aspect-square rounded-lg overflow-hidden bg-dark-700">
                {f.preview ? (
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image size={24} className="text-gray-500" />
                  </div>
                )}
                <button onClick={() => removeFile(f.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={12} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <p className="text-[10px] text-gray-300 truncate">{f.file.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upload progress */}
          {uploading && progress.overall !== undefined && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Uploading...</span>
                <span>{progress.overall}%</span>
              </div>
              <div className="w-full bg-dark-600 rounded-full h-2">
                <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${progress.overall}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={handleUpload} disabled={uploading || files.length === 0 || !selectedEvent}
        className="btn-primary w-full justify-center py-3 text-base">
        {uploading ? `Uploading... ${progress.overall || 0}%` : `Upload ${files.length > 0 ? files.length + ' file(s)' : ''}`}
      </button>
    </div>
  );
}