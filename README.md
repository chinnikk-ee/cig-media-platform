# CIG Event & Media Management Platform

A full-stack event media platform with AI tagging, facial recognition, real-time notifications, and cloud storage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL via Supabase |
| Storage | Cloudinary |
| AI Tagging | Imagga API |
| Real-time | Socket.io |
| Auth | JWT |

---

## Setup (Step by Step)

### Step 1 — Get your API keys (all free)

#### Supabase (Database)
1. Go to https://supabase.com → Sign up → New Project
2. Once created, go to **Settings → API**
3. Copy: `Project URL`, `anon public key`, `service_role key`
4. Go to **SQL Editor** → paste the entire contents of `backend/src/config/schema.sql` → Run

#### Cloudinary (Image Storage)
1. Go to https://cloudinary.com → Sign up (free)
2. On dashboard, copy: `Cloud Name`, `API Key`, `API Secret`

#### Imagga (AI Tagging)
1. Go to https://imagga.com → Sign up (free tier: 1000 images/month)
2. Go to dashboard → copy `API Key` and `API Secret`

---

### Step 2 — Backend Setup

```bash
cd backend
copy .env.example .env
```

Open `.env` and fill in all your keys from Step 1.

```bash
npm install
npm run dev
```

Backend will run at http://localhost:5000

---

### Step 3 — Frontend Setup

Open a **new terminal window**:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at http://localhost:5173

Open http://localhost:5173 in your browser. You're live!

---

## Features

### Core
- **Event Management** — Create, edit, delete events with cover images, QR codes, categories
- **Media Upload** — Drag & drop, bulk upload up to 50 files, video support
- **Access Control** — 4 roles: Admin, Photographer, Member, Viewer
- **Public/Private** — Per-event and per-media visibility control

### Social
- Like, Comment, Share, Download (with watermark)
- Add to Favourites
- Tag friends in photos
- Real-time notifications (Socket.io)

### AI/ML
- **Smart Tagging** — Imagga API auto-tags every uploaded photo
- **Tag Search** — Search by AI-generated tags
- **Facial Recognition** — Upload selfie → find all your photos across events
- **Full-text Search** — By event name, username, tags, date range

### Cloud
- Cloudinary for image/video storage with auto-compression
- QR code generation for album sharing
- Watermarked downloads (club name + event name + role)
- Infinite scroll gallery

---

## Project Structure

```
cig-platform/
├── backend/
│   ├── src/
│   │   ├── config/         # Supabase, Cloudinary, DB schema
│   │   ├── controllers/    # Auth, Events, Media, Social, Search
│   │   ├── middleware/     # JWT auth, file upload
│   │   ├── routes/         # All API routes
│   │   └── utils/          # Socket.io, notifications
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/     # Layout, MediaCard, NotificationPanel
    │   ├── context/        # Auth, Socket contexts
    │   ├── pages/          # All pages
    │   └── utils/          # Axios API instance
    └── package.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/events | List events |
| POST | /api/events | Create event |
| GET | /api/events/:id/media | Get event media |
| POST | /api/media/upload | Upload files |
| GET | /api/media/:id/download | Download with watermark |
| POST | /api/media/selfie | Upload selfie for face recognition |
| GET | /api/media/my-photos | Get face-matched photos |
| POST | /api/social/like | Like/unlike |
| POST | /api/social/comment | Add comment |
| POST | /api/social/favourite | Toggle favourite |
| POST | /api/social/tag | Tag user in photo |
| GET | /api/search | Search everything |
| GET | /api/notifications | Get notifications |

---

## Database Schema

See `backend/src/config/schema.sql` for the complete schema with:
- `users` — roles, selfie for face recognition
- `events` — with QR code, categories
- `media` — AI tags, face data, download count
- `likes`, `comments`, `favourites`, `media_tags`
- `notifications` — real-time notification log
- `face_matches` — facial recognition results
- Views: `media_with_counts`, `events_with_counts`

---

## Deployment

### Deploy Backend (Railway)
1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select your repo → set root to `/backend`
3. Add all environment variables from `.env`
4. Done — Railway gives you a public URL

### Deploy Frontend (Vercel)
1. Go to https://vercel.com → New Project → Import from GitHub
2. Set root to `/frontend`
3. Add env variable: `VITE_API_URL=your_railway_backend_url`
4. Done — Vercel gives you a public URL

---

## Evaluation Criteria Coverage

| Criteria | Implementation |
|----------|---------------|
| UI/UX (15%) | Dark theme, responsive, infinite scroll, drag-drop |
| Backend APIs (15%) | Express REST API, all CRUD operations |
| Auth & Access Control (10%) | JWT, 4 roles, public/private media |
| Cloud Integration (15%) | Cloudinary storage + Imagga AI |
| Media Management (15%) | Upload, compress, watermark, download |
| AI/ML Features (15%) | Auto-tagging, search by tags, face recognition |
| Real-time Notifications (5%) | Socket.io, live comments |
| Code Quality (5%) | Modular structure, controllers, middleware |
| Innovation/Bonus (5%) | QR sharing, infinite scroll, AI captions |
