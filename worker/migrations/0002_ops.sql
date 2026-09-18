ALTER TABLE users ADD COLUMN locked_at TEXT;
ALTER TABLE users ADD COLUMN locked_reason TEXT;

CREATE TABLE IF NOT EXISTS ops_sessions (
  token_hash TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_user_id TEXT,
  ip_hash TEXT NOT NULL,
  ua_hash TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_created ON ops_audit (created_at);

CREATE TABLE IF NOT EXISTS ops_http_events (
  bucket TEXT NOT NULL,
  status_class TEXT NOT NULL,
  route_group TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, status_class, route_group)
);
