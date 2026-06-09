# CIG Platform — Data Schema & Architecture

> Event & media management platform for photography clubs. Photographers upload event
> media; members browse, like, comment, tag, and favourite; AI auto-tags photos and
> facial recognition surfaces "photos of me." Admins manage events, users, and roles.

**Stack:** React 18 + Vite (frontend) · Node.js + Express (backend) · PostgreSQL via
Supabase · Cloudinary (media storage) · Socket.io (realtime) · JWT auth · Imagga
(AI tagging) · AWS Rekognition (face recognition).

---

## 1. Data Schema (Entity-Relationship Diagram)

```mermaid
erDiagram
    users ||--o{ events            : "creates (created_by)"
    users ||--o{ media             : "uploads (uploaded_by)"
    users ||--o{ likes             : "gives"
    users ||--o{ comments          : "writes"
    users ||--o{ favourites        : "saves"
    users ||--o{ face_matches      : "matched in"
    users ||--o{ role_requests     : "requests"
    users ||--o{ media_tags        : "is tagged (tagged_user)"
    users ||--o{ event_photographers : "assigned to"

    events ||--o{ media            : "contains"
    events ||--o{ event_photographers : "has shooters"
    events ||--o{ notifications     : "context"

    media ||--o{ likes             : "receives"
    media ||--o{ comments          : "receives"
    media ||--o{ favourites        : "saved as"
    media ||--o{ media_tags        : "has tags"
    media ||--o{ face_matches      : "yields"
    media ||--o{ notifications     : "context"

    users {
        uuid        id PK
        varchar     email UK
        varchar     password_hash
        varchar     username UK
        varchar     full_name
        text        avatar_url
        varchar     role "admin|photographer|member|viewer (def viewer)"
        varchar     club_name
        boolean     is_active "def true"
        text        selfie_url "face-recognition reference"
        jsonb       face_data "stored face descriptors"
        timestamptz created_at
        timestamptz updated_at
    }

    events {
        uuid        id PK
        varchar     name
        text        description
        varchar     category
        date        event_date
        varchar     location
        text        cover_image
        boolean     is_public "def true"
        uuid        created_by FK "users.id ON DELETE SET NULL"
        varchar     club_name
        text        qr_code "album-share QR URL"
        timestamptz created_at
        timestamptz updated_at
    }

    media {
        uuid        id PK
        uuid        event_id FK "events.id ON DELETE CASCADE"
        uuid        uploaded_by FK "users.id ON DELETE SET NULL"
        text        url "Cloudinary secure_url"
        text        thumbnail_url
        text        public_id "Cloudinary public_id"
        varchar     media_type "image|video (def image)"
        text        file_name
        bigint      file_size
        integer     width
        integer     height
        boolean     is_public "def true"
        text_arr    ai_tags "Imagga auto-tags (GIN indexed)"
        text        caption "AI or manual"
        jsonb       faces_detected "bounding boxes & descriptors"
        integer     download_count "def 0"
        timestamptz created_at
    }

    likes {
        uuid        id PK
        uuid        user_id FK "ON DELETE CASCADE"
        uuid        media_id FK "ON DELETE CASCADE"
        timestamptz created_at
    }

    comments {
        uuid        id PK
        uuid        user_id FK "ON DELETE CASCADE"
        uuid        media_id FK "ON DELETE CASCADE"
        text        content
        timestamptz created_at
        timestamptz updated_at
    }

    favourites {
        uuid        id PK
        uuid        user_id FK "ON DELETE CASCADE"
        uuid        media_id FK "ON DELETE CASCADE"
        timestamptz created_at
    }

    media_tags {
        uuid        id PK
        uuid        media_id FK "ON DELETE CASCADE"
        uuid        tagged_by FK "users.id ON DELETE CASCADE"
        uuid        tagged_user FK "users.id ON DELETE CASCADE"
        timestamptz created_at
    }

    notifications {
        uuid        id PK
        uuid        user_id FK "recipient ON DELETE CASCADE"
        uuid        actor_id FK "trigger ON DELETE SET NULL"
        varchar     type "like|comment|tag|upload|share|follow"
        uuid        media_id FK "ON DELETE CASCADE"
        uuid        event_id FK "ON DELETE CASCADE"
        text        message
        boolean     is_read "def false"
        timestamptz created_at
    }

    face_matches {
        uuid        id PK
        uuid        user_id FK "ON DELETE CASCADE"
        uuid        media_id FK "ON DELETE CASCADE"
        float       confidence
        timestamptz created_at
    }

    role_requests {
        uuid        id PK
        uuid        user_id FK "users.id"
        varchar     requested_role "member|photographer"
        text        reason
        varchar     status "pending|approved|rejected (def pending)"
        uuid        reviewed_by FK "users.id"
        timestamptz created_at
        timestamptz updated_at
    }

    event_photographers {
        uuid        id PK
        uuid        event_id FK "events.id"
        uuid        photographer_id FK "users.id"
        uuid        assigned_by FK "users.id"
        timestamptz created_at
    }

    removed_users {
        uuid        id PK
        varchar     email UK
        varchar     password_hash
        varchar     username
        varchar     full_name
        text        reason
        uuid        removed_by FK "users.id ON DELETE SET NULL"
        timestamptz created_at
    }
```

### Unique constraints
| Table | Unique key | Purpose |
|---|---|---|
| `users` | `email`, `username` | one account per email / handle |
| `likes` | `(user_id, media_id)` | one like per user per media |
| `favourites` | `(user_id, media_id)` | one favourite per user per media |
| `media_tags` | `(media_id, tagged_user)` | tag a user once per photo |
| `face_matches` | `(user_id, media_id)` | one match row per user per media |
| `event_photographers` | `(event_id, photographer_id)` | assign a shooter once |
| `removed_users` | `email` | tombstone lookup on re-login |

### Indexes
`idx_media_event_id`, `idx_media_uploaded_by`, `idx_media_ai_tags` (GIN on `ai_tags`),
`idx_likes_media_id`, `idx_comments_media_id`, `idx_notifications_user (user_id, is_read)`,
`idx_face_matches_user`, `idx_events_date (event_date DESC)`, `idx_removed_users_email`.

### Views
- **`media_with_counts`** — `media` + uploader name/avatar + event name + aggregated
  `like_count`, `comment_count`, `favourite_count` (drives the gallery).
- **`events_with_counts`** — `events` + creator username + `media_count`.

> **Schema note:** `users`, `events`, `media`, `likes`, `comments`, `media_tags`,
> `favourites`, `notifications`, `face_matches` live in
> [backend/src/config/schema.sql](backend/src/config/schema.sql). `removed_users` is in
> [migrations/002_removed_users.sql](backend/src/config/migrations/002_removed_users.sql).
> **`role_requests` and `event_photographers` are used by the code but have no committed
> SQL file** — they must already exist in Supabase. A migration should be added for them
> to keep the schema reproducible.

---

## 2. System Architecture

```mermaid
flowchart TB
    subgraph Client["🖥️ Browser — React 18 + Vite SPA :5173"]
        UI["Pages: Home · Events · EventDetail · Upload<br/>Media · Search · Profile · Favourites<br/>MyPhotos · RequestAccess · AdminDashboard"]
        CTX["Context: AuthContext (JWT) · SocketContext"]
        FACEJS["face-api.js (client-side match)"]
        API_CLIENT["axios client<br/>JWT interceptor · 401 auto-logout"]
        UI --- CTX
        UI --- FACEJS
        CTX --- API_CLIENT
    end

    subgraph Server["⚙️ Node.js + Express API :5000"]
        ROUTES["Routes: /api/{auth,events,media,social,<br/>search,notifications,users,admin}"]
        MW["Middleware: authenticate / optionalAuth (JWT)<br/>rbac (canUpload, canDelete, canView, canInteract)<br/>multer (upload)"]
        CTRL["Controllers: auth · event · media<br/>social · search · notification · admin"]
        SOCK["Socket.io server<br/>notifications · comments · presence"]
        ROUTES --- MW --- CTRL
        CTRL --- SOCK
    end

    DB[("🗄️ Supabase<br/>PostgreSQL")]
    CDN[("☁️ Cloudinary<br/>image/video store<br/>+ watermark")]
    IMAGGA["🏷️ Imagga API<br/>auto-tagging"]
    REKOG["👤 AWS Rekognition<br/>face detection"]

    API_CLIENT -- "HTTPS REST /api" --> ROUTES
    CTX <-. "WebSocket" .-> SOCK

    CTRL -- "supabase-js" --> DB
    CTRL -- "upload / transform / download" --> CDN
    CTRL -- "tag photos" --> IMAGGA
    CTRL -- "detect faces" --> REKOG

    classDef ext fill:#fef3c7,stroke:#d97706,color:#92400e
    classDef store fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    class IMAGGA,REKOG ext
    class DB,CDN store
```

### Request flow examples
**Photo upload** → `POST /api/media/upload` → `authenticate` + RBAC `canUploadToEvent`
→ multer buffers files → Cloudinary upload (chunked if >9 MB) → Imagga tags +
Rekognition faces → rows written to `media` (+ `face_matches`) → Socket.io emits
`notification:new` to event subscribers.

**"My photos"** → `POST /api/media/selfie` stores `selfie_url`/`face_data` →
`GET /api/media/my-photos` matches the user's descriptor against `media.faces_detected`
(client-side via face-api.js) and `face_matches` rows.

**Download** → `GET /api/media/:id/download` → Cloudinary transform stamps a watermark
(club + event + role) and increments `download_count`.

---

## 3. Roles & Authorization

| Role | Can do |
|---|---|
| **admin** | Everything: create/edit/delete events, manage users, assign photographers, review role requests, view stats |
| **photographer** | Upload media to **assigned** events; delete own uploads |
| **member** | Like, comment, favourite, tag users |
| **viewer** | Read-only; may submit a `role_request` to upgrade |

Auth is stateless **JWT** (Bearer header, `JWT_EXPIRES_IN` default `7d`). Frontend stores
`token` + `user` in `localStorage`; axios attaches the token and auto-logs-out on 401.
RBAC helpers in [rbac.middleware.js](backend/src/middleware/rbac.middleware.js) gate
per-event upload, per-media delete, private-event viewing, and viewer interaction.

---

## 4. API Surface (summary)

| Group | Key endpoints |
|---|---|
| **auth** `/api/auth` | `POST /register` · `POST /login` · `GET/PUT /profile` · `PUT /change-password` |
| **events** `/api/events` | `GET /` · `POST /` (admin) · `GET/PUT/DELETE /:id` (admin for write) · `GET /:id/media` |
| **media** `/api/media` | `POST /upload` (photographer/admin) · `GET /my-photos` · `POST /selfie` · `GET /:id` · `DELETE /:id` · `GET /:id/download` |
| **social** `/api/social` | `POST /like` · `POST /comment` · `DELETE /comment/:id` · `POST /favourite` · `GET /favourites` · `POST /tag` · `DELETE /tag/:id` · `GET /share/:id` |
| **search** `/api/search` | `GET /` (q, type, tags, date range, paging) |
| **notifications** `/api/notifications` | `GET /` · `POST /mark-read` |
| **users** `/api/users` | `GET /search` · `GET /:id` |
| **admin** `/api/admin` | `stats` · `requests` + `requests/:id/review` · user CRUD + `users/:id/role` · `assign-photographer` / `remove-photographer` · `event-photographers/:event_id` · public: `public-stats`, `request-role`, `my-request` |

---

## 5. Environment Variables

```
SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_KEY
JWT_SECRET · JWT_EXPIRES_IN (7d)
CLOUDINARY_CLOUD_NAME · CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET
IMAGGA_API_KEY · IMAGGA_API_SECRET
AWS_REGION (us-east-1) · AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY
PORT (5000) · FRONTEND_URL (http://localhost:5173) · NODE_ENV
```

*Frontend:* `VITE_API_URL` (falls back to `/api` dev proxy).
