import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Upload, Calendar } from 'lucide-react';

const CATEGORIES = ['Photography','Workshop','Trip','Competition','Cultural Fest','Party','Sports','Other'];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', category: '', event_date: '', location: '', is_public: true,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] }, multiple: false,
    onDrop: ([file]) => { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); },
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Event name is required');
    setLoading(true);
    try {
      let cover_image = null;

      // Upload cover image first if provided
      if (coverFile) {
        const fd = new FormData();
        fd.append('files', coverFile);
        fd.append('event_id', 'temp'); // will be replaced
        // We'll use cloudinary directly via a temp event, or just skip cover for now
        // Simpler: upload as part of event creation using base64
        const reader = new FileReader();
        cover_image = await new Promise(res => {
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(coverFile);
        });
      }

      const res = await api.post('/events', { ...form, cover_image });
      toast.success('Event created!');
      navigate(`/events/${res.data.event.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create event');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-gray-400 mt-1">Set up a new event album</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cover image */}
        <div className="card p-5">
          <h2 className="font-medium mb-3">Cover Image</h2>
          <div {...getRootProps()}
            className={`rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
              ${isDragActive ? 'border-primary-500 bg-primary-600/10' : 'border-dark-500 hover:border-primary-500/50'}`}>
            <input {...getInputProps()} />
            {coverPreview ? (
              <div className="relative aspect-video">
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-sm text-white">Click to change</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-gray-500">
                <Upload size={28} className="mb-2" />
                <p className="text-sm">Drag & drop or click to upload cover image</p>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="card p-5 space-y-4">
          <h2 className="font-medium">Event Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Event Name *</label>
            <input value={form.name} onChange={set('name')} className="input" placeholder="Annual Photography Exhibition" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea value={form.description} onChange={set('description')} className="input resize-none h-24"
              placeholder="Describe your event..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              <select value={form.category} onChange={set('category')} className="input">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Event Date</label>
              <input type="date" value={form.event_date} onChange={set('event_date')} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
            <input value={form.location} onChange={set('location')} className="input" placeholder="College Auditorium, Chennai" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm({ ...form, is_public: !form.is_public })}
              className={`relative w-10 h-6 rounded-full transition-all ${form.is_public ? 'bg-primary-600' : 'bg-dark-600'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.is_public ? 'left-5' : 'left-1'}`} />
            </button>
            <div>
              <span className="text-sm font-medium text-gray-300">{form.is_public ? 'Public Event' : 'Private Event'}</span>
              <p className="text-xs text-gray-500">{form.is_public ? 'Visible to everyone' : 'Only club members can see this'}</p>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}
