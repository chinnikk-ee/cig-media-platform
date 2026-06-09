# CIG Platform

A full-stack event media management platform for clubs and organizations to host, share, and discover photos and videos from events. Features AI-powered facial recognition, real-time notifications, role-based access control, and cloud-first media storage.

---

## Features

### Event Management
- Create events with name, date, location, category, and cover image
- Per-event QR code generation for shareable album links
- Public/private visibility control per event and per media item

### Media Upload & Storage
- Drag-and-drop bulk upload (up to 50 files per session)
- Concurrent uploads with 4 parallel workers
- Images auto-optimized via Cloudinary transformations
- Video support up to 100 MB with chunked upload (6 MB chunks for files >9 MB)
- All files stored in Cloudinary under `/cig-platform/{event_id}/`

### AI / Machine Learning
- **Facial Recognition** — Upload a selfie to find all photos of yourself across every event (AWS Rekognition, 85% similarity threshold)
- **AI Auto-tagging** — Imagga API auto-tags every uploaded image for searchability
- **Tag-based Search** — Query media by AI-generated tags

### Social
- Like, comment, and favourite any media item
- Tag other users in photos
- Watermarked downloads (club name + event name + user role overlaid via Sharp)
- Real-time comments and notifications via Socket.io

### Search & Discovery
- Full-text search across event names, usernames, and AI tags
- Date range filtering
- Infinite scroll galleries with Masonry layout

### Access Control
| Role | Capabilities |
|------|-------------|
| **Admin** | Create/delete events, upload/delete any media, manage users, approve role requests |
| **Photographer** | Upload to assigned events, delete own uploads, view all media |
| **Member** | Like, comment, favourite, tag, download; no upload access |
| **Viewer** | View public media only; can submit a role upgrade request |

### Real-time (Socket.io)
- Live comment broadcast to all viewers of a media item
- Upload alerts pushed to everyone in an event room
- Per-user notification stream for likes, comments, tags, and role decisions
- Face scan progress events (`face_match_started`, `face_match_complete`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Backend | Node.js + Express 4 |
| Database | PostgreSQL via Supabase |
| File Storage | Cloudinary |
| Authentication | JWT (7-day expiry) |
| Real-time | Socket.io 4 |
| Facial Recognition | AWS Rekognition |
| AI Tagging | Imagga API |
| Image Processing | Sharp + Canvas |
| Deployment | Railway (backend) + Vercel (frontend) |

---

## Project Structure

```
cig-platform/
├── backend/
│   ├── src/
│   │   ├── server.js               # Express + Socket.io entry point
│   │   ├── config/
│   │   │   ├── schema.sql          # Full PostgreSQL DDL
│   │   │   ├── supabase.js
│   │   │   ├── cloudinary.js
│   │   │   ├── rekognition.js
│   │   │   └── migrations/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── event.controller.js
│   │   │   ├── media.controller.js
│   │   │   ├── social.controller.js
│   │   │   ├── search.controller.js
│   │   │   ├── notification.controller.js
│   │   │   └── admin.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT verify + optional auth
│   │   │   ├── rbac.middleware.js   # Role-based permission checks
│   │   │   └── upload.middleware.js # Multer + Cloudinary storage
│   │   ├── routes/
│   │   └── utils/
│   │       ├── socket.js
│   │       ├── faceRecognition.js
│   │       └── notifications.js
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Routes + ProtectedRoute wrapper
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── MediaCard.jsx
│   │   │   ├── MasonryGrid.jsx
│   │   │   ├── NotificationPanel.jsx
│   │   │   └── Skeleton.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── EventsPage.jsx
│   │   │   ├── EventDetailPage.jsx
│   │   │   ├── MediaDetailPage.jsx
│   │   │   ├── UploadPage.jsx
│   │   │   ├── MyPhotosPage.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   ├── FavouritesPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── RequestAccessPage.jsx
│   │   └── utils/
│   │       └── api.js              # Axios instance with JWT interceptor
│   ├── Dockerfile
│   └── nginx.conf                  # Reverse proxy + React Router fallback
│
└── docker-compose.yml
```

---

## Local Setup

### Prerequisites

- Node.js 20+
- Free accounts on: [Supabase](https://supabase.com), [Cloudinary](https://cloudinary.com), [AWS](https://aws.amazon.com) (Rekognition), [Imagga](https://imagga.com)

---

### Step 1 — Get API keys

**Supabase**
1. Create a new project at supabase.com
2. Go to **Settings → API** and copy: Project URL, `anon` public key, `service_role` key
3. Go to **SQL Editor**, paste the full contents of `backend/src/config/schema.sql`, and run it

**Cloudinary**
1. Sign up at cloudinary.com (free tier)
2. From the dashboard copy: Cloud Name, API Key, API Secret

**AWS Rekognition**
1. Create an IAM user with `rekognition:CompareFaces` and `rekognition:DetectFaces` permissions
2. Generate an access key pair and note your region (e.g. `us-east-1`)

**Imagga**
1. Sign up at imagga.com (free tier: 1000 images/month)
2. From the dashboard copy your API Key and API Secret

---

### Step 2 — Backend

```bash
cd backend
cp .env.example .env   # Windows: copy .env.example .env
```

Fill in `.env`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

IMAGGA_API_KEY=xxx
IMAGGA_API_SECRET=xxx

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

```bash
npm install
npm run dev
```

Backend runs at `http://localhost:5000`.

---

### Step 3 — Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

### Docker (optional)

```bash
docker-compose up
```

Starts backend on port 5000 and frontend on port 80.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/profile` | JWT | Get current user |
| GET | `/api/events` | Optional | List events |
| POST | `/api/events` | Admin | Create event |
| GET | `/api/events/:id/media` | Optional | Get media for event |
| POST | `/api/media/upload` | Photographer/Admin | Upload files |
| GET | `/api/media/:id/download` | JWT | Download with watermark |
| POST | `/api/media/selfie` | JWT | Upload selfie, trigger face scan |
| GET | `/api/media/my-photos` | JWT | Get face-matched photos |
| DELETE | `/api/media/:id` | Owner/Admin | Delete media |
| POST | `/api/social/like` | JWT | Toggle like |
| POST | `/api/social/comment` | JWT | Add comment |
| POST | `/api/social/favourite` | JWT | Toggle favourite |
| POST | `/api/social/tag` | JWT | Tag user in photo |
| GET | `/api/search` | Optional | Search media and events |
| GET | `/api/notifications` | JWT | Get notifications |
| GET | `/api/admin/users` | Admin | List all users |
| GET | `/api/admin/role-requests` | Admin | List pending role requests |
| POST | `/api/admin/role-requests/:id` | Admin | Approve or deny request |

---

## Database Schema

Full DDL is in `backend/src/config/schema.sql`. Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Accounts, roles, avatar, selfie URL, face descriptor (JSONB) |
| `events` | Event metadata, QR code, visibility, cover image |
| `media` | Cloudinary URL/public_id, media type, AI tags (TEXT[]), face data, download count |
| `likes` | User ↔ media junction |
| `comments` | Comments with timestamps |
| `favourites` | User ↔ media junction |
| `media_tags` | User tagging in photos |
| `notifications` | Notification log for real-time delivery |
| `face_matches` | Rekognition results (user ↔ media, similarity score) |
| `role_requests` | Viewer upgrade requests |
| `removed_users` | Tombstone for deleted accounts |

**Views:** `media_with_counts` and `events_with_counts` pre-aggregate like/comment counts to avoid N+1 queries.

---

## Deployment

### Backend — Railway

1. New Project → Deploy from GitHub
2. Set root directory to `/backend`
3. Add all environment variables from `.env`
4. Railway assigns a public HTTPS URL

### Frontend — Vercel

1. New Project → Import from GitHub
2. Set root directory to `/frontend`
3. Add environment variable: `VITE_API_URL=<your Railway backend URL>`
4. Vercel assigns a public URL

Socket.io works over WSS on both platforms without additional configuration.

---

## Key Implementation Notes

**Large file uploads** — files under 9 MB use Cloudinary's stream upload; files 9 MB and above use `upload_large` with 6 MB chunks. Temp files are cleaned up after chunked uploads complete.

**Facial recognition flow** — user uploads selfie → Rekognition detects and stores face descriptor → async job compares descriptor against all event photos at 85% threshold → matches stored in `face_matches` → Socket.io notifies client when complete.

**Watermarked downloads** — Sharp composites the club name, event name, and user role as a text overlay onto the image server-side before streaming it to the client.

**JWT flow** — token stored in `localStorage`, attached to every request via Axios interceptor. A 401 response (except on `/login` and `/register`) auto-redirects to the login page.

**Pagination** — backend uses SQL `LIMIT`/`OFFSET`; frontend uses `react-infinite-scroll-component` with a Masonry grid layout.
