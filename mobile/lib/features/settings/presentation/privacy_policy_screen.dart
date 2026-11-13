import 'package:flutter/material.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy Policy')),
      body: StudyPageContainer(
        children: [
          Text(
            'Roshan Study Privacy Commitment',
            style: theme.textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            '1. No Mandatory Account or Personal Data\n'
            'Roshan Study never asks for your name, phone number, email address, CNIC, or school name.\n\n'
            '2. Local-First Storage\n'
            'Your board, grade, bookmarks, reading positions, practice attempts, mock exam scores, and spaced-revision schedule are stored locally on your device in SQLite.\n\n'
            '3. Optional Pseudonymous Sync\n'
            'In MVP mode, progress stays 100% on your device. If online pack sync is enabled, only a random resettable device ID and unique attempt IDs are used to prevent duplicate records.\n\n'
            '4. Safety & Curriculum Separation\n'
            'Grades 9–12 SSC/HSSC board preparation and MDCAT/ETEA entrance tracks remain strictly isolated.',
            style: theme.textTheme.bodyLarge,
          ),
        ],
      ),
    );
  }
}
