-- ═══════════════════════════════════════════════════════════
--  CIG Event & Media Management Platform — Database Schema
--  Run this entire file in your Supabase SQL editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username      VARCHAR(100) UNIQUE NOT NULL,
  full_name     VARCHAR(255),
  avatar_url    TEXT,
  role          VARCHAR(20) DEFAULT 'viewer'
                CHECK (role IN ('admin', 'photographer', 'member', 'viewer')),
  club_name     VARCHAR(255),
  is_active     BOOLEAN DEFAULT true,
  selfie_url    TEXT,          -- for facial recognition reference
  face_data     JSONB,         -- stored face descriptors
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  category     VARCHAR(100),
  event_date   DATE,
  location     VARCHAR(255),
  cover_image  TEXT,
  is_public    BOOLEAN DEFAULT true,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  club_name    VARCHAR(255),
  qr_code      TEXT,           -- QR code URL for album sharing
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MEDIA ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  url             TEXT NOT NULL,
  thumbnail_url   TEXT,
  public_id       TEXT NOT NULL,   -- Cloudinary public_id for management
  media_type      VARCHAR(10) DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  file_name       TEXT,
  file_size       BIGINT,
  width           INTEGER,
  height          INTEGER,
  is_public       BOOLEAN DEFAULT true,
  ai_tags         TEXT[],          -- auto-generated tags from Imagga
  caption         TEXT,            -- AI-generated or manual caption
  faces_detected  JSONB,           -- face bounding boxes & descriptors
  download_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LIKES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  media_id   UUID REFERENCES media(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id)
);

-- ─── COMMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  media_id   UUID REFERENCES media(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TAGS (user tagging in photos) ──────────────────────────
CREATE TABLE IF NOT EXISTS media_tags (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id     UUID REFERENCES media(id) ON DELETE CASCADE,
  tagged_by    UUID REFERENCES users(id) ON DELETE CASCADE,
  tagged_user  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, tagged_user)
);

-- ─── FAVOURITES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favourites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  media_id   UUID REFERENCES media(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,  -- recipient
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL, -- who triggered it
  type       VARCHAR(50) NOT NULL
             CHECK (type IN ('like','comment','tag','upload','share','follow')),
  media_id   UUID REFERENCES media(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FACE MATCHES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS face_matches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  media_id   UUID REFERENCES media(id) ON DELETE CASCADE,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id)
);

-- ─── INDEXES (for fast queries) ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_media_event_id     ON media(event_id);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by  ON media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_ai_tags      ON media USING GIN(ai_tags);
CREATE INDEX IF NOT EXISTS idx_likes_media_id     ON likes(media_id);
CREATE INDEX IF NOT EXISTS idx_comments_media_id  ON comments(media_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_face_matches_user  ON face_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date        ON events(event_date DESC);

-- ─── VIEWS ───────────────────────────────────────────────────

-- Media with counts (used in gallery)
CREATE OR REPLACE VIEW media_with_counts AS
SELECT
  m.*,
  u.username      AS uploader_name,
  u.avatar_url    AS uploader_avatar,
  e.name          AS event_name,
  COUNT(DISTINCT l.id) AS like_count,
  COUNT(DISTINCT c.id) AS comment_count,
  COUNT(DISTINCT f.id) AS favourite_count
FROM media m
LEFT JOIN users    u ON m.uploaded_by = u.id
LEFT JOIN events   e ON m.event_id    = e.id
LEFT JOIN likes    l ON l.media_id    = m.id
LEFT JOIN comments c ON c.media_id    = m.id
LEFT JOIN favourites f ON f.media_id  = m.id
GROUP BY m.id, u.username, u.avatar_url, e.name;

-- Events with media counts
CREATE OR REPLACE VIEW events_with_counts AS
SELECT
  e.*,
  u.username AS creator_name,
  COUNT(DISTINCT m.id) AS media_count
FROM events e
LEFT JOIN users u ON e.created_by = u.id
LEFT JOIN media m ON m.event_id  = e.id
GROUP BY e.id, u.username;
