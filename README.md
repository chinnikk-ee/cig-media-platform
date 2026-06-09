# CIG Platform

This is my full-stack project — an event media platform for clubs and organizations where people can upload, share and find photos and videos from events. The cool part is the AI facial recognition (you upload a selfie and it finds all the photos you're in). It also has real-time notifications, different user roles, and stores everything on the cloud.

I built this with a React frontend and a Node/Express backend, using Postgres (through Supabase) for the database.

---

## Features

### Events
- Make events with a name, date, location, category and a cover image
- Each event gets its own QR code so you can share the album link
- You can set events (and individual photos) to public or private

### Uploading and storage
- Drag and drop upload, up to 50 files at once
- Uploads run 4 at a time so it's a bit faster
- Images get optimized automatically by Cloudinary
- Videos work too (up to 100 MB) — big files get uploaded in 6 MB chunks
- Everything is saved in Cloudinary under `/cig-platform/{event_id}/`

### AI stuff
- **Facial recognition** — upload a selfie and it finds all the photos of you across every event. This uses AWS Rekognition with an 85% match threshold.
- **Auto tagging** — every uploaded image gets tagged automatically (also using AWS Rekognition's label detection) so they're searchable
- **Search by tag** — you can search media using those auto-generated tags

### Social
- Like, comment and favourite any photo/video
- Tag other users in photos
- Downloads come with a watermark on them (club name + event name + your role, added with Sharp)
- Comments and notifications happen in real time with Socket.io

### Search
- Search across event names, usernames and tags
- Filter by a date range
- Galleries use infinite scroll with a Masonry (Pinterest-style) layout

### Roles / permissions
| Role | What they can do |
|------|-------------|
| **Admin** | Create/delete events, upload/delete any media, manage users, approve role requests |
| **Photographer** | Upload to events they're assigned to, delete their own uploads, see all media |
| **Member** | Like, comment, favourite, tag, download (no uploading) |
| **Viewer** | Only see public media, can ask to be upgraded to a higher role |

### Real-time (Socket.io)
- New comments show up live for everyone looking at a photo
- People in an event get notified when something new is uploaded
- Each user has their own notification stream for likes, comments, tags and role decisions
- Face scan progress events (`face_match_started`, `face_match_complete`)

---

## Tech Stack

| Layer | What I used |
|-------|-----------|
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Backend | Node.js + Express 4 |
| Database | PostgreSQL (Supabase) |
| File Storage | Cloudinary |
| Auth | JWT (expires after 7 days) |
| Real-time | Socket.io 4 |
| Face recognition + AI tagging | AWS Rekognition |
| Image processing | Sharp + Canvas |
| Hosting | Railway (backend) + Vercel (frontend) |

---

## Project Structure

```
cig-platform/
├── backend/
│   ├── src/
│   │   ├── server.js               # Express + Socket.io entry point
│   │   ├── config/
│   │   │   ├── schema.sql          # the Postgres tables
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
│   │   │   ├── auth.middleware.js   # checks the JWT
│   │   │   ├── rbac.middleware.js   # role permission checks
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
│   │   ├── App.jsx                 # routes + ProtectedRoute wrapper
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
│   │       └── api.js              # axios setup with the JWT interceptor
│   ├── Dockerfile
│   └── nginx.conf
│
└── docker-compose.yml
```

---

## How to run it locally

### Step 0 — get the API keys first

You need free accounts on these services before anything will work:

**Supabase** (database)
1. Make a new project at supabase.com
2. Go to **Settings → API** and copy the Project URL, the `anon` public key, and the `service_role` key
3. Go to **SQL Editor**, paste in everything from `backend/src/config/schema.sql`, and run it

**Cloudinary** (where the media is stored)
1. Sign up at cloudinary.com (the free tier is fine)
2. From the dashboard copy the Cloud Name, API Key and API Secret

**AWS Rekognition** (face recognition + auto tagging)
1. Make an IAM user with `rekognition:CompareFaces`, `rekognition:DetectFaces` and `rekognition:DetectLabels` permissions
2. Make an access key pair and note your region (mine is `us-east-1`)

---

### Option A — Docker (easiest)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/).

**1. Make the env file**

```bash
cd backend
cp .env.example .env   # on Windows: copy .env.example .env
```

Then fill in `backend/.env` with your keys from Step 0:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

PORT=5000
FRONTEND_URL=http://localhost
NODE_ENV=production
```

**2. Start it**

```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:5000 |

To stop it: `docker-compose down`

---

### Option B — running it manually

You need Node.js 20+.

**1. Make the env file** (same as above)

```bash
cd backend
cp .env.example .env   # on Windows: copy .env.example .env
```

Fill in `backend/.env` with your keys:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

**2. Start the backend**

```bash
cd backend
npm install
npm run dev
```

It runs at `http://localhost:5000`.

**3. Start the frontend**

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

It runs at `http://localhost:5173`.

---

## API Reference

| Method | Endpoint | Auth | What it does |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Make an account |
| POST | `/api/auth/login` | — | Log in, returns a JWT |
| GET | `/api/auth/profile` | JWT | Get the current user |
| GET | `/api/events` | Optional | List events |
| POST | `/api/events` | Admin | Create an event |
| GET | `/api/events/:id/media` | Optional | Get the media for an event |
| POST | `/api/media/upload` | Photographer/Admin | Upload files |
| GET | `/api/media/:id/download` | JWT | Download with watermark |
| POST | `/api/media/selfie` | JWT | Upload a selfie, start the face scan |
| GET | `/api/media/my-photos` | JWT | Get the photos you were matched in |
| DELETE | `/api/media/:id` | Owner/Admin | Delete media |
| POST | `/api/social/like` | JWT | Like / unlike |
| POST | `/api/social/comment` | JWT | Add a comment |
| POST | `/api/social/favourite` | JWT | Favourite / unfavourite |
| POST | `/api/social/tag` | JWT | Tag a user in a photo |
| GET | `/api/search` | Optional | Search media and events |
| GET | `/api/notifications` | JWT | Get notifications |
| GET | `/api/admin/users` | Admin | List all users |
| GET | `/api/admin/role-requests` | Admin | List pending role requests |
| POST | `/api/admin/role-requests/:id` | Admin | Approve or deny a request |

---

## Database

The full SQL is in `backend/src/config/schema.sql`. The main tables are:

| Table | What it's for |
|-------|---------|
| `users` | Accounts, roles, avatar, selfie URL, face data (JSONB) |
| `events` | Event info, QR code, visibility, cover image |
| `media` | Cloudinary URL/public_id, media type, AI tags (TEXT[]), face data, download count |
| `likes` | Links a user to a media item |
| `comments` | Comments with timestamps |
| `favourites` | Links a user to a media item |
| `media_tags` | Tagging users in photos |
| `notifications` | Notifications for the real-time stuff |
| `face_matches` | Rekognition results (user ↔ media + similarity score) |
| `role_requests` | Viewer upgrade requests |
| `removed_users` | Keeps a record of deleted accounts |

There are also two views, `media_with_counts` and `events_with_counts`, that pre-add up the like/comment counts so I don't have to run a bunch of extra queries.

---

## Some notes on how things work

**Big file uploads** — files under 9 MB use Cloudinary's normal stream upload. Files 9 MB and up use `upload_large` with 6 MB chunks. The temp files get deleted after the chunked upload finishes.

**Face recognition** — user uploads a selfie → Rekognition finds and stores the face data → a background job compares it against all the event photos at the 85% threshold → matches go into `face_matches` → Socket.io tells the client when it's done.

**Watermarked downloads** — Sharp puts the club name, event name and the user's role as text on top of the image on the server before sending it back.

**JWT** — the token is kept in `localStorage` and added to every request through an axios interceptor. If a request comes back 401 (except on login/register) it sends you back to the login page.

**Pagination** — the backend uses SQL `LIMIT`/`OFFSET` and the frontend uses `react-infinite-scroll-component` with the Masonry grid.
