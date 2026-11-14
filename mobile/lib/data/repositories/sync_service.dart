import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
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

class RemoteCatalogPage {
  const RemoteCatalogPage({
    required this.items,
    required this.total,
    required this.page,
    required this.hasMore,
  });

  final List<CatalogChapterSummary> items;
  final int total;
  final int page;
  final bool hasMore;
}

/// Optional idempotent sync worker for queued student attempts and cloud chapter packs.
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

  static const Duration requestTimeout = Duration(seconds: 12);
  static const String _envApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  String? get effectiveCatalogBaseUrl {
    final explicit = (apiBaseUrl ?? '').trim();
    if (explicit.isNotEmpty) return explicit.replaceAll(RegExp(r'/$'), '');
    final fromEnv = _envApiBaseUrl.trim();
    if (fromEnv.isNotEmpty) return fromEnv.replaceAll(RegExp(r'/$'), '');
    return null;
  }

  Future<RemoteCatalogPage> fetchRemoteCatalog({
    ProgrammeId? programmeId,
    int? grade,
    String query = '',
    int page = 1,
    int limit = 20,
  }) async {
    final base = effectiveCatalogBaseUrl;
    if (base == null) {
      throw StateError(
        'Cloud API URL not configured. Build with --dart-define=API_BASE_URL=https://your-server to browse cloud chapters.',
      );
    }

    final uri = Uri.parse('$base/v1/catalog').replace(
      queryParameters: {
        if (programmeId != null) 'programmeId': programmeId.id,
        if (grade != null) 'grade': '$grade',
        if (query.trim().isNotEmpty) 'q': query.trim(),
        'page': '$page',
        'limit': '$limit',
      },
    );
    final http.Response res;
    try {
      res = await _client.get(uri).timeout(requestTimeout);
    } on TimeoutException {
      throw StateError(
        'Cloud catalog timed out. Your downloaded offline chapters remain available.',
      );
    } on http.ClientException {
      throw StateError(
        'No internet connection to reach cloud catalog. Your offline chapters remain ready.',
      );
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw StateError('Catalog returned HTTP ${res.statusCode}');
    }
    final decoded = jsonDecode(res.body) as Map<String, dynamic>;
    final rawItems = (decoded['items'] as List?) ?? const [];
    return RemoteCatalogPage(
      items: rawItems
          .whereType<Map<String, dynamic>>()
          .map(CatalogChapterSummary.fromJson)
          .toList(growable: false),
      total: (decoded['total'] as num?)?.toInt() ?? 0,
      page: (decoded['page'] as num?)?.toInt() ?? page,
      hasMore: decoded['hasMore'] == true,
    );
  }

  Future<ChapterPack> downloadAndSaveChapterPack({
    required String chapterId,
    required int version,
    required ContentRepository contentRepo,
    String? expectedSha256,
  }) async {
    final base = effectiveCatalogBaseUrl;
    if (base == null) {
      throw StateError('Cloud API URL not configured.');
    }
    final uri = Uri.parse('$base/v1/packs/$chapterId/$version');
    final http.Response res;
    try {
      res = await _client.get(uri).timeout(requestTimeout);
    } on TimeoutException {
      throw StateError('Pack download timed out. Please retry when signal improves.');
    } on http.ClientException {
      throw StateError('Unable to reach server — check your internet connection.');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw StateError('Pack download failed (HTTP ${res.statusCode})');
    }
    final decoded = jsonDecode(res.body) as Map<String, dynamic>;
    final packMap = decoded['pack'] is Map<String, dynamic>
        ? decoded['pack'] as Map<String, dynamic>
        : decoded;
    final pack = ChapterPack.fromJson(packMap);
    final rawPackJson = jsonEncode(packMap);
    contentRepo.saveVerifiedChapterPack(
      pack: pack,
      rawJson: rawPackJson,
      expectedSha256: expectedSha256,
    );
    return pack;
  }

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
      final response = await _client
          .post(
            Uri.parse('$apiBaseUrl/v1/sync/attempts'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'deviceUuid': profile.deviceUuid,
              'attempts': attempts,
            }),
          )
          .timeout(requestTimeout);

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
