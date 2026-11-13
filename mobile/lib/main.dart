import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/app/app.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final localDb = await LocalDatabase.openDefault();

  runApp(
    ProviderScope(
      overrides: [
        localDatabaseProvider.overrideWithValue(localDb),
      ],
      child: const RoshanStudyApp(),
    ),
  );
}
