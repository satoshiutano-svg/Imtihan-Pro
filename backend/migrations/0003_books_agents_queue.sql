-- Migration 0003: Books PDF Vault, External Agent Registry, Publish History Rollback
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  programme_id TEXT NOT NULL DEFAULT 'ssc_hssc',
  grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
  group_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  curriculum TEXT NOT NULL,
  source_book TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sha256 TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  page_texts_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  publication_status TEXT NOT NULL DEFAULT 'published',
  is_student_visible INTEGER NOT NULL DEFAULT 1,
  permission_verified INTEGER NOT NULL DEFAULT 1,
  uploaded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_sha256 ON books(sha256);
CREATE INDEX IF NOT EXISTS idx_books_prog_grade ON books(programme_id, grade, is_student_visible);

CREATE TABLE IF NOT EXISTS registered_agents (
  worker_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tool_kind TEXT NOT NULL,
  roles_json TEXT NOT NULL DEFAULT '[]',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'online',
  registered_at TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  quota_remaining_note TEXT,
  current_task_id TEXT
);

CREATE TABLE IF NOT EXISTS publish_history (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  pack_version INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'cloudflare_d1_r2',
  note TEXT,
  snapshot_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_publish_history_chapter ON publish_history(chapter_id, pack_version DESC);
