import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/core/database/local_database.dart';

/// Must be overridden in `main.dart` with an opened [LocalDatabase].
/// Defaults to an in-memory instance so widget tests can run cleanly out of the box.
final localDatabaseProvider = Provider<LocalDatabase>((ref) {
  final db = LocalDatabase.inMemory();
  ref.onDispose(db.close);
  return db;
});
