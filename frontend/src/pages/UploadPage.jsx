import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import {
  Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Search,
  Calendar, Globe, Lock, ChevronDown, RotateCw, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

// How many files to upload at the same time. Each request is independent, so
// running a few in parallel cuts the total wait dramatically vs. one-at-a-time.
const UPLOAD_CONCURRENCY = 4;

const fmtSize = (b) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/* Searchable event picker — thumbnail + name + date per option */
function EventPicker({ events, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const selected = events.find(e => String(e.id) === String(value));

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = events.filter(e => e.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input flex items-center gap-3 text-left">
        {selected ? (
          <>
            <div className="w-8 h-8 rounded bg-dark-700 overflow-hidden flex-shrink-0">
              {selected.cover_image
                ? <img src={selected.cover_image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={13} className="text-dark-500" /></div>}
            </div>
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-gray-500">Choose an event…</span>
        )}
        <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 card overflow-hidden shadow-xl shadow-black/40">
          <div className="relative border-b border-dark-600">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              className="w-full bg-transparent text-sm pl-9 pr-3 py-2.5 outline-none placeholder-gray-500"
              placeholder="Search events…" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">No events match</p>
            ) : filtered.map(e => (
              <button key={e.id} type="button"
                onClick={() => { onChange(e.id); setOpen(false); setQ(''); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-dark-700 transition-colors ${String(e.id) === String(value) ? 'bg-primary-600/10' : ''}`}>
                <div className="w-10 h-8 rounded bg-dark-700 overflow-hidden flex-shrink-0">
                  {e.cover_image
                    ? <img src={e.cover_image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={13} className="text-dark-500" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{e.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {!e.is_public && <Lock size={9} />}
                    {e.event_date ? format(new Date(e.event_date), 'MMM d, yyyy') : 'No date'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [searchParams] = useSearchParams();
  const presetEvent = searchParams.get('event') || '';
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/events?limit=50')
      .then(res => {
        const list = res.data.events || [];
        setEvents(list);
        if (presetEvent && list.some(ev => String(ev.id) === String(presetEvent))) {
          setSelectedEvent(presetEvent);
        }
      })
      .catch(() => toast.error('Failed to load events'));
  }, [presetEvent]);

  const onDrop = useCallback(accepted => {
    const validated = accepted.filter(f => {
      const isImage = f.type.startsWith('image/');
      const maxSize = isImage ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
      if (f.size > maxSize) {
        toast.error(`${f.name} exceeds ${isImage ? 10 : 100}MB limit`);
        return false;
      }
      return true;
    });
    const mapped = validated.map(f => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      status: 'pending',   // pending | uploading | done | failed
      progress: 0,
    }));
    setFiles(prev => {
      const combined = [...prev, ...mapped];
      if (combined.length > 50) { toast.error('Max 50 files at once'); return combined.slice(0, 50); }
      return combined;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'video/*': [] }, multiple: true, maxFiles: 50,
  });

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));
  const patchFile = (id, patch) => setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const selectedEventObj = events.find(ev => String(ev.id) === String(selectedEvent));
  const isPrivateEvent = selectedEventObj && !selectedEventObj.is_public;

  const uploadOne = async (f) => {
    patchFile(f.id, { status: 'uploading', progress: 0 });
    const fd = new FormData();
    fd.append('event_id', selectedEvent);
    fd.append('is_public', isPrivateEvent ? false : isPublic);
    fd.append('files', f.file);
    try {
      await api.post('/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          // Once the bytes are all sent, the server is still saving the file —
          // show a "processing" state instead of a misleading stuck-at-100% bar.
          patchFile(f.id, pct >= 100 ? { progress: 100, status: 'processing' } : { progress: pct });
        },
      });
      patchFile(f.id, { status: 'done', progress: 100 });
      return true;
    } catch {
      patchFile(f.id, { status: 'failed' });
      return false;
    }
  };

  // Run an array of files through uploadOne with a fixed concurrency limit.
  const runQueue = async (queue) => {
    let ok = 0, fail = 0, next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const f = queue[next++];
        (await uploadOne(f)) ? ok++ : fail++;
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker)
    );
    return { ok, fail };
  };

  const handleUpload = async () => {
    if (!selectedEvent) return toast.error('Please select an event');
    const queue = files.filter(f => f.status === 'pending' || f.status === 'failed');
    if (queue.length === 0) return toast.error('Please add files');

    setUploading(true);
    const { ok, fail } = await runQueue(queue);
    setUploading(false);
    if (fail === 0) toast.success(`${ok} file${ok !== 1 ? 's' : ''} uploaded!`);
    else toast.error(`${ok} uploaded, ${fail} failed — retry below`);
  };

  const retryFile = async (f) => {
    setUploading(true);
    await uploadOne(f);
    setUploading(false);
  };

  // Summary counts
  const counts = files.reduce((a, f) => { a[f.status] = (a[f.status] || 0) + 1; return a; }, {});
  const pendingCount = (counts.pending || 0) + (counts.failed || 0);
  const allDone = files.length > 0 && files.every(f => f.status === 'done');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Media</h1>
        <p className="text-slate-500 mt-1">Upload photos and videos to an event album</p>
      </div>

      {/* Event selector + visibility */}
      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Select Event *</label>
          <EventPicker events={events} value={selectedEvent} onChange={setSelectedEvent} />
          <Link to="/events/new" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-2">
            <Plus size={12} /> Create new event
          </Link>
        </div>

        {/* Prominent visibility toggle */}
        {isPrivateEvent ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-dark-700 rounded-lg px-3 py-2.5">
            <Lock size={15} className="text-yellow-400" />
            Private event — all uploaded media will be private.
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Media visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${isPublic ? 'border-primary-500 bg-primary-600/15 text-primary-700' : 'border-dark-600 text-slate-500 hover:border-dark-500'}`}>
                <Globe size={15} /> Public
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${!isPublic ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-700' : 'border-dark-600 text-slate-500 hover:border-dark-500'}`}>
                <Lock size={15} /> Private
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dropzone */}
      <div {...getRootProps()}
        className={`card p-12 text-center cursor-pointer border-2 border-dashed transition-all
          ${isDragActive ? 'border-primary-500 bg-primary-600/10 animate-pulse' : 'border-dark-500 hover:border-primary-500/50'}`}>
        <input {...getInputProps()} />
        <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${isDragActive ? 'bg-primary-600/20' : 'bg-dark-700'}`}>
          <Upload size={28} className={isDragActive ? 'text-primary-400' : 'text-gray-500'} />
        </div>
        {isDragActive ? (
          <p className="text-primary-400 font-medium">Drop files to add them</p>
        ) : (
          <>
            <p className="text-slate-600 font-medium text-lg">Drag & drop photos or videos</p>
            <p className="text-gray-500 text-sm mt-2">or click to browse · Max 10MB photos, 100MB videos · Up to 50 files</p>
          </>
        )}
      </div>

      {/* Upload queue */}
      {files.length > 0 && (
        <div className="card p-4 space-y-3">
          {/* Summary row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-medium">{files.length} file{files.length !== 1 ? 's' : ''}</span>
              <span className="text-gray-500">
                {counts.uploading ? ` · ${counts.uploading} uploading` : ''}
                {counts.processing ? ` · ${counts.processing} processing` : ''}
                {counts.done ? ` · ${counts.done} done` : ''}
                {counts.failed ? ` · ${counts.failed} failed` : ''}
              </span>
            </p>
            <button onClick={() => setFiles([])} disabled={uploading}
              className="text-sm text-slate-500 hover:text-red-400 disabled:opacity-40">Clear all</button>
          </div>

          {/* Per-file rows */}
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-dark-800 rounded-lg p-2.5">
                <div className="w-12 h-12 rounded bg-dark-700 overflow-hidden flex-shrink-0">
                  {f.preview
                    ? <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-gray-500" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm truncate">{f.file.name}</p>
                    <span className="text-xs text-gray-500 flex-shrink-0">{fmtSize(f.file.size)}</span>
                  </div>
                  {/* progress bar */}
                  <div className="mt-1.5 h-1.5 rounded-full bg-dark-600 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${f.status === 'failed' ? 'bg-red-500' : f.status === 'done' ? 'bg-green-500' : f.status === 'processing' ? 'bg-primary-500 animate-pulse' : 'bg-primary-500'}`}
                      style={{ width: `${f.status === 'done' || f.status === 'failed' || f.status === 'processing' ? 100 : f.progress}%` }} />
                  </div>
                </div>
                {/* status / actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 w-16 justify-end">
                  {f.status === 'uploading' && <span className="text-xs text-slate-500">{f.progress}%</span>}
                  {f.status === 'processing' && <span className="text-xs text-primary-400">Saving…</span>}
                  {f.status === 'done' && <CheckCircle size={18} className="text-green-500" />}
                  {f.status === 'failed' && (
                    <button onClick={() => retryFile(f)} disabled={uploading}
                      className="text-yellow-400 hover:text-yellow-300 disabled:opacity-40" title="Retry">
                      <RotateCw size={16} />
                    </button>
                  )}
                  {(f.status === 'pending' || f.status === 'failed') && !uploading && (
                    <button onClick={() => removeFile(f.id)} className="text-gray-500 hover:text-red-400" title="Remove">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success state */}
      {allDone && !uploading ? (
        <div className="card p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <CheckCircle size={28} className="text-green-400" />
          </div>
          <div>
            <p className="font-semibold">All {counts.done} file{counts.done !== 1 ? 's' : ''} uploaded!</p>
            <p className="text-sm text-slate-500 mt-1">Your media is now in the album.</p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            {selectedEvent && (
              <Link to={`/events/${selectedEvent}`} className="btn-primary">View in album</Link>
            )}
            <button onClick={() => setFiles([])} className="btn-secondary">Upload more</button>
          </div>
        </div>
      ) : (
        <button onClick={handleUpload} disabled={uploading || pendingCount === 0 || !selectedEvent}
          className="btn-primary w-full justify-center py-3 text-base">
          {uploading ? 'Uploading…' : `Upload ${pendingCount > 0 ? pendingCount + ' file' + (pendingCount !== 1 ? 's' : '') : ''}`}
        </button>
      )}
    </div>
  );
}
