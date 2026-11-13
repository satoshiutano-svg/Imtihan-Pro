import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class SyncFlushResult {
  const SyncFlushResult({
    required this.attempted,
    required this.synced,
    required this.skippedOfflineOrLocalOnly,
    this.errorMessage,
  });

  final int attempted;
  final int synced;
  final bool skippedOfflineOrLocalOnly;
  final String? errorMessage;
}

/// Optional idempotent sync worker for queued student attempts.
///
/// Honors [AppConstants.localOnlyProgressMvp] in MVP so no background network
/// calls are required or made unless an API base URL is explicitly configured.
class SyncService {
  SyncService(this._db, this._profileRepo, {http.Client? client, this.apiBaseUrl})
      : _client = client ?? http.Client();

  final LocalDatabase _db;
  final ProfileRepository _profileRepo;
  final http.Client _client;
  final String? apiBaseUrl;

  Future<SyncFlushResult> flushPendingOutbox({int batchSize = 25}) async {
    if (AppConstants.localOnlyProgressMvp || apiBaseUrl == null || apiBaseUrl!.isEmpty) {
      return const SyncFlushResult(
        attempted: 0,
        synced: 0,
        skippedOfflineOrLocalOnly: true,
      );
    }

    final pendingRows = _db.db.select(
      "SELECT attempt_uuid, payload_json FROM sync_outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ?;",
      [batchSize],
    );

    if (pendingRows.isEmpty) {
      return const SyncFlushResult(
        attempted: 0,
        synced: 0,
        skippedOfflineOrLocalOnly: false,
      );
    }

    final profile = _profileRepo.loadOrCreateProfile();
    final attempts = pendingRows
        .map((r) => jsonDecode(r['payload_json'] as String) as Map<String, dynamic>)
        .toList(growable: false);

    try {
      final response = await _client.post(
        Uri.parse('$apiBaseUrl/v1/sync/attempts'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'deviceUuid': profile.deviceUuid,
          'attempts': attempts,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final uuids = pendingRows.map((r) => r['attempt_uuid'] as String);
        _db.db.execute('BEGIN TRANSACTION;');
        try {
          for (final id in uuids) {
            _db.db.execute(
              "UPDATE sync_outbox SET status = 'synced' WHERE attempt_uuid = ?;",
              [id],
            );
          }
          _db.db.execute('COMMIT;');
        } catch (e) {
          _db.db.execute('ROLLBACK;');
          rethrow;
        }
        return SyncFlushResult(
          attempted: pendingRows.length,
          synced: pendingRows.length,
          skippedOfflineOrLocalOnly: false,
        );
      }

      _incrementRetries(pendingRows.map((r) => r['attempt_uuid'] as String));
      return SyncFlushResult(
        attempted: pendingRows.length,
        synced: 0,
        skippedOfflineOrLocalOnly: false,
        errorMessage: 'Server returned HTTP ${response.statusCode}',
      );
    } catch (e) {
      _incrementRetries(pendingRows.map((r) => r['attempt_uuid'] as String));
      return SyncFlushResult(
        attempted: pendingRows.length,
        synced: 0,
        skippedOfflineOrLocalOnly: true,
        errorMessage: e.toString(),
      );
    }
  }

  void _incrementRetries(Iterable<String> uuids) {
    for (final id in uuids) {
      _db.db.execute(
        'UPDATE sync_outbox SET retry_count = retry_count + 1 WHERE attempt_uuid = ?;',
        [id],
      );
    }
  }
}

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(
    ref.watch(localDatabaseProvider),
    ref.watch(profileRepositoryProvider),
  );
});
