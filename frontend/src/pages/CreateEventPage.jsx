import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Upload, Calendar, MapPin, Tag, Globe, Lock, Image, X, AlertCircle } from 'lucide-react';

const CATEGORIES = ['Photography','Workshop','Trip','Competition','Cultural Fest','Party','Sports','Other'];

const CATEGORY_ICONS = {
  'Photography':  '📷',
  'Workshop':     '🛠️',
  'Trip':         '✈️',
  'Competition':  '🏆',
  'Cultural Fest':'🎭',
  'Party':        '🎉',
  'Sports':       '⚽',
  'Other':        '📌',
};

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', category: '', event_date: '', location: '',
    is_public: true, is_media_public: true,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] }, multiple: false,
    onDrop: ([file]) => { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); },
  });

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Event name is required';
    else if (form.name.trim().length < 3) errs.name = 'Name must be at least 3 characters';
    if (!form.event_date) errs.event_date = 'Event date is required';
    if (!form.category) errs.category = 'Please pick a category';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      let cover_image = null;
      if (coverFile) {
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-slate-500 text-sm mt-1">Set up a new event album for your photos and videos</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

          {/* LEFT — Cover + Visibility (40%) */}
          <div className="md:col-span-2 space-y-4">

            {/* Cover image */}
            <div className="card p-4">
              <h2 className="font-medium text-sm text-slate-600 mb-3 flex items-center gap-2">
                <Image size={14} /> Cover Image
              </h2>
              <div
                {...getRootProps()}
                className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
                  ${isDragActive ? 'border-primary-500 bg-primary-600/10 scale-[1.01]' : 'border-dark-500 hover:border-primary-500/50 hover:bg-dark-700/50'}`}
                style={{ aspectRatio: '3/2' }}
              >
                <input {...getInputProps()} />
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity gap-2">
                      <Upload size={22} className="text-white" />
                      <p className="text-white text-xs font-medium">Change cover</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2 px-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-dark-600 flex items-center justify-center mb-1">
                      <Upload size={18} className={isDragActive ? 'text-primary-600' : 'text-gray-500'} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      {isDragActive ? 'Drop it here' : 'Drag & drop'}
                    </p>
                    <p className="text-xs text-gray-600">or click to browse · JPG, PNG, WebP</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">Recommended: 1200×800px or wider</p>
            </div>

            {/* Event Visibility — card buttons */}
            <div className="card p-4">
              <h2 className="font-medium text-sm text-slate-600 mb-3">Event Visibility</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_public: true })}
                  className={`p-3 rounded-xl border transition-all text-left ${form.is_public ? 'border-primary-500 bg-primary-600/15' : 'border-dark-600 hover:border-dark-500'}`}
                >
                  <Globe size={16} className={form.is_public ? 'text-primary-600' : 'text-gray-500'} />
                  <p className={`text-sm font-medium mt-1.5 ${form.is_public ? 'text-primary-700' : 'text-slate-500'}`}>Public</p>
                  <p className="text-xs text-gray-600 mt-0.5">Visible to everyone</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_public: false, is_media_public: false })}
                  className={`p-3 rounded-xl border transition-all text-left ${!form.is_public ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-dark-600 hover:border-dark-500'}`}
                >
                  <Lock size={16} className={!form.is_public ? 'text-yellow-400' : 'text-gray-500'} />
                  <p className={`text-sm font-medium mt-1.5 ${!form.is_public ? 'text-yellow-600' : 'text-slate-500'}`}>Private</p>
                  <p className="text-xs text-gray-600 mt-0.5">Members only</p>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT — Form fields (60%) */}
          <div className="md:col-span-3 space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="font-medium text-sm text-slate-600">Event Details</h2>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Event Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={set('name')}
                  className={`input text-sm ${errors.name ? 'border-red-500/60 focus:border-red-500' : ''}`}
                  placeholder="Annual Photography Exhibition"
                />
                {errors.name && (
                  <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5">
                    <AlertCircle size={12} /> {errors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={set('description')}
                  className="input resize-none h-20 text-sm"
                  placeholder="Describe your event…"
                />
              </div>

              {/* Date + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Calendar size={12} /> Date <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={form.event_date} onChange={set('event_date')}
                    className={`input text-sm ${errors.event_date ? 'border-red-500' : ''}`} />
                  {errors.event_date && (
                    <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5">
                      <AlertCircle size={12} /> {errors.event_date}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <MapPin size={12} /> Location
                  </label>
                  <input
                    value={form.location}
                    onChange={set('location')}
                    className="input text-sm"
                    placeholder="College Auditorium"
                  />
                </div>
              </div>
            </div>

            {/* Category visual picker */}
            <div className="card p-5">
              <h2 className="font-medium text-sm text-slate-600 mb-3 flex items-center gap-2">
                <Tag size={13} /> Category <span className="text-red-400">*</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setForm({ ...form, category: form.category === c ? '' : c }); if (errors.category) setErrors(prev => ({ ...prev, category: null })); }}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                      form.category === c
                        ? 'border-primary-500 bg-primary-600/15 text-primary-700'
                        : 'border-dark-600 text-slate-500 hover:border-dark-500 hover:text-slate-600'
                    }`}
                  >
                    <span>{CATEGORY_ICONS[c]}</span>
                    <span className="text-xs">{c}</span>
                  </button>
                ))}
              </div>
              {errors.category && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                  <AlertCircle size={12} /> {errors.category}
                </p>
              )}
              {form.category && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, category: '' })}
                  className="mt-2 text-xs text-gray-500 hover:text-slate-600 transition-colors flex items-center gap-1"
                >
                  <X size={11} /> Clear selection
                </button>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-sm font-semibold"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Calendar size={16} /> Create Event
                </>
              )}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}