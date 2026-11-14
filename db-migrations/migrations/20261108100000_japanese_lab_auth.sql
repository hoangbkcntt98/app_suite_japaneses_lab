CREATE TABLE IF NOT EXISTS japanese_lab_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS japanese_lab_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES japanese_lab_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS japanese_lab_sessions_user_id_idx
  ON japanese_lab_sessions (user_id);

CREATE INDEX IF NOT EXISTS japanese_lab_sessions_expires_at_idx
  ON japanese_lab_sessions (expires_at);
