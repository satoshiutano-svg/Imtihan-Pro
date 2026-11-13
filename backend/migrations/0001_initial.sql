-- Roshan Study D1 Initial Schema (Phases 3, 6, 8, 10)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS programmes (
  id TEXT PRIMARY KEY, -- 'ssc_hssc', 'mdcat', 'etea_eng', 'uni_entrance'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY, -- 'peshawar', 'mardan', 'swat', 'malakand', 'abbottabad', 'kohat', 'bannu', 'dikhan'
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_groups (
  id TEXT PRIMARY KEY, -- 'ssc_science', 'ssc_humanities', 'hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'
  grade_level_band TEXT NOT NULL CHECK (grade_level_band IN ('ssc', 'hssc')),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  medium TEXT NOT NULL DEFAULT 'en' CHECK (medium IN ('en', 'ur')),
  text_direction TEXT NOT NULL DEFAULT 'ltr' CHECK (text_direction IN ('ltr', 'rtl'))
);

CREATE TABLE IF NOT EXISTS subject_mappings (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES programmes(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
  group_id TEXT NOT NULL REFERENCES academic_groups(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  is_compulsory INTEGER NOT NULL DEFAULT 1,
  elective_slot TEXT, -- e.g. 'science_choice' (Biology vs Computer Science)
  UNIQUE(programme_id, grade, group_id, subject_id)
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
  programme_id TEXT NOT NULL DEFAULT 'ssc_hssc' REFERENCES programmes(id),
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  learning_outcomes_json TEXT NOT NULL DEFAULT '[]',
  publication_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'in_review', 'approved', 'published', 'unpublished')),
  current_pack_version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ur')),
  text_direction TEXT NOT NULL DEFAULT 'ltr' CHECK (text_direction IN ('ltr', 'rtl')),
  payload_json TEXT NOT NULL, -- 12-part structured concept fields
  source_book TEXT NOT NULL,
  source_edition TEXT NOT NULL DEFAULT '',
  source_page TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'published')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL DEFAULT 'ssc_hssc' REFERENCES programmes(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
  group_id TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  concept_id TEXT REFERENCES concepts(id),
  question_type TEXT NOT NULL CHECK (question_type IN (
    'mcq', 'conceptual', 'recall', 'fill_in', 'numerical',
    'short_answer', 'long_answer', 'diagram_based', 'application'
  )),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 7),
  statement TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ur')),
  text_direction TEXT NOT NULL DEFAULT 'ltr' CHECK (text_direction IN ('ltr', 'rtl')),
  payload_json TEXT NOT NULL, -- options, hints, numerical steps, marking points
  answer_json TEXT NOT NULL,  -- correct option / value / model answer
  explanation TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'official_past_paper', 'official_model_paper', 'practice_original'
  )),
  source_board_id TEXT REFERENCES boards(id),
  source_year INTEGER,
  source_paper_ref TEXT,
  source_page_ref TEXT,
  publication_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'in_review', 'approved', 'published', 'unpublished')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  chapter_id TEXT REFERENCES chapters(id),
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('diagram', 'textbook_pdf', 'past_paper_pdf')),
  license_verified INTEGER NOT NULL DEFAULT 0, -- Must be 1 before PDF publish
  license_note TEXT NOT NULL DEFAULT '',
  telegram_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapter_packs (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  telegram_message_id TEXT,
  published_at TEXT NOT NULL,
  UNIQUE(chapter_id, version)
);

-- Pseudonymous optional sync table (MVP defaults to 100% local on-device)
CREATE TABLE IF NOT EXISTS sync_attempts (
  attempt_uuid TEXT PRIMARY KEY,
  device_uuid TEXT NOT NULL,
  question_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapters_subject_status ON chapters(subject_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_status ON questions(chapter_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_sync_attempts_device ON sync_attempts(device_uuid, attempted_at);
