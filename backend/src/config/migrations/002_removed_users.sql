-- ═══════════════════════════════════════════════════════════
--  Migration 002 — Admin user removal (hard delete + tombstone)
--  Run this in your Supabase SQL editor
-- ═══════════════════════════════════════════════════════════

-- When an admin removes a user we DELETE their row from `users`, but keep a
-- lightweight tombstone here so the next login attempt can show a one-time
-- "you were removed" notice. We copy the password_hash so the notice is only
-- revealed on a correct-password login (prevents email probing). The row is
-- deleted again once the notice has been shown, after which login falls back
-- to the generic "Invalid email or password".
CREATE TABLE IF NOT EXISTS removed_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username      VARCHAR(100),
  full_name     VARCHAR(255),
  reason        TEXT,                       -- admin-supplied description
  removed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_removed_users_email ON removed_users(email);
