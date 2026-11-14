-- Roshan Study D1 Autonomous Operations & Exam Extension (Migration 0002)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exam_blueprints (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES programmes(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
  group_id TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_kind TEXT NOT NULL CHECK (exam_kind IN (
    'topic_quiz', 'chapter_test', 'subject_test', 'board_model_exam', 'mock_exam'
  )),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  total_marks INTEGER NOT NULL DEFAULT 20,
  sections_json TEXT NOT NULL DEFAULT '[]',
  publication_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'in_review', 'approved', 'published', 'unpublished')),
  review_stage TEXT NOT NULL DEFAULT 'ai_generated',
  pack_version INTEGER NOT NULL DEFAULT 1,
  reviewed_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapter_review_reports (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  job_id TEXT,
  review_stage TEXT NOT NULL,
  overall_passed INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  checks_json TEXT NOT NULL DEFAULT '[]',
  escalation_reasons_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_issue_reports (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  question_id TEXT,
  concept_id TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'draft_fix_created', 'resolved')),
  proposed_draft_chapter_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exams_programme_status
  ON exam_blueprints(programme_id, grade, publication_status);
CREATE INDEX IF NOT EXISTS idx_review_reports_chapter
  ON chapter_review_reports(chapter_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_issues_status
  ON content_issue_reports(status, updated_at);
