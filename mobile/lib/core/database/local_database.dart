import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart';

/// Local-first SQLite database with versioned schema migrations.
///
/// Supports both on-device persistent storage and `:memory:` instances for
/// fast deterministic unit and widget testing.
class LocalDatabase {
  LocalDatabase._(this.db);

  final Database db;

  static const int currentSchemaVersion = 2;

  static Future<LocalDatabase> openDefault() async {
    final dir = await getApplicationDocumentsDirectory();
    final dbPath = p.join(dir.path, 'roshan_study_v1.sqlite');
    await Directory(p.dirname(dbPath)).create(recursive: true);
    final db = sqlite3.open(dbPath);
    final instance = LocalDatabase._(db);
    instance.migrate();
    return instance;
  }

  factory LocalDatabase.inMemory() {
    final db = sqlite3.openInMemory();
    final instance = LocalDatabase._(db);
    instance.migrate();
    return instance;
  }

  void migrate() {
    db.execute('PRAGMA foreign_keys = ON;');
    final versionRow = db.select('PRAGMA user_version;').first;
    final existingVersion = versionRow.values.first as int? ?? 0;

    if (existingVersion < 1) {
      db.execute('''
        CREATE TABLE IF NOT EXISTS student_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          device_uuid TEXT NOT NULL,
          board_id TEXT NOT NULL,
          grade INTEGER NOT NULL,
          group_id TEXT NOT NULL,
          selected_electives_json TEXT NOT NULL DEFAULT '[]',
          exam_date_iso TEXT,
          theme_mode TEXT NOT NULL DEFAULT 'system',
          reading_scale REAL NOT NULL DEFAULT 1.0,
          onboarding_completed INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS downloaded_chapters (
          chapter_id TEXT PRIMARY KEY,
          subject_id TEXT NOT NULL,
          programme_id TEXT NOT NULL DEFAULT 'ssc_hssc',
          pack_version INTEGER NOT NULL,
          checksum_sha256 TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          pack_json TEXT NOT NULL,
          downloaded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_progress (
          concept_id TEXT PRIMARY KEY,
          chapter_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          scroll_offset REAL NOT NULL DEFAULT 0.0,
          is_completed INTEGER NOT NULL DEFAULT 0,
          is_bookmarked INTEGER NOT NULL DEFAULT 0,
          last_read_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS question_attempts (
          attempt_uuid TEXT PRIMARY KEY,
          programme_id TEXT NOT NULL DEFAULT 'ssc_hssc',
          question_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          concept_id TEXT NOT NULL,
          difficulty INTEGER NOT NULL,
          is_correct INTEGER NOT NULL,
          self_score_marks INTEGER,
          max_marks INTEGER NOT NULL DEFAULT 1,
          hints_used INTEGER NOT NULL DEFAULT 0,
          time_spent_sec INTEGER NOT NULL DEFAULT 0,
          attempted_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS revision_schedule (
          concept_id TEXT PRIMARY KEY,
          chapter_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          concept_title TEXT NOT NULL,
          interval_days INTEGER NOT NULL DEFAULT 1,
          consecutive_correct INTEGER NOT NULL DEFAULT 0,
          mistake_count INTEGER NOT NULL DEFAULT 0,
          next_review_at TEXT NOT NULL,
          last_reviewed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mock_exam_results (
          id TEXT PRIMARY KEY,
          programme_id TEXT NOT NULL DEFAULT 'ssc_hssc',
          exam_id TEXT NOT NULL,
          title TEXT NOT NULL,
          board_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          max_score INTEGER NOT NULL,
          duration_sec INTEGER NOT NULL,
          completed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attempt_uuid TEXT NOT NULL UNIQUE,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_attempts_prog_chapter
          ON question_attempts(programme_id, chapter_id);
        CREATE INDEX IF NOT EXISTS idx_revision_due
          ON revision_schedule(next_review_at);
        CREATE INDEX IF NOT EXISTS idx_sync_pending
          ON sync_outbox(status);
      ''');
    }

    if (existingVersion < 2) {
      db.execute('''
        CREATE TABLE IF NOT EXISTS daily_progress (
          date_iso TEXT PRIMARY KEY,
          questions_completed INTEGER NOT NULL DEFAULT 0,
          lessons_completed INTEGER NOT NULL DEFAULT 0,
          streak_days INTEGER NOT NULL DEFAULT 0,
          grace_freezes_remaining INTEGER NOT NULL DEFAULT 2,
          daily_board_done INTEGER NOT NULL DEFAULT 0,
          daily_mdcat_done INTEGER NOT NULL DEFAULT 0
        );
      ''');
    }

    db.execute('PRAGMA user_version = $currentSchemaVersion;');
  }

  void close() {
    db.dispose();
  }
}
