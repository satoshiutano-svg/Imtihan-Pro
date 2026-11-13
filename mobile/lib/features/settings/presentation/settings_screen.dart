import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/app/theme/display_preferences_controller.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/rtl_aware_text.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(displayPreferencesProvider);
    final controller = ref.read(displayPreferencesProvider.notifier);
    final profile = ref.watch(studentProfileProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Display & Preferences')),
      body: StudyPageContainer(
        children: [
          StudySectionHeader(
            kicker: 'Study Profile',
            title: 'Academic Profile',
            subtitle:
                '${profile.board.displayName} • ${profile.grade.label} • ${profile.group.displayName}',
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              FilledButton.tonalIcon(
                onPressed: () => context.push('/onboarding'),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Change Board / Grade'),
              ),
              OutlinedButton.icon(
                onPressed: () => context.push('/downloads'),
                icon: const Icon(Icons.download_for_offline_outlined),
                label: const Text('Offline Storage'),
              ),
            ],
          ),

          const StudyDivider(verticalPadding: AppSpacing.xl),

          const StudySectionHeader(
            title: 'Appearance',
            subtitle: 'Choose comfortable lighting for daylight or evening study',
          ),
          const SizedBox(height: AppSpacing.sm),
          SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(value: ThemeMode.system, label: Text('System')),
              ButtonSegment(value: ThemeMode.light, label: Text('Light')),
              ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
            ],
            selected: {prefs.themeMode},
            onSelectionChanged: (selection) {
              controller.setThemeMode(selection.first);
            },
          ),

          const StudyDivider(verticalPadding: AppSpacing.xl),

          StudySectionHeader(
            title: 'Reading Text Size',
            trailing: Text(
              '${(prefs.readingScale * 100).round()}%',
              style: AppTypography.tabular(
                theme.textTheme.labelLarge,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
          Slider(
            value: prefs.readingScale,
            min: 0.85,
            max: 1.5,
            divisions: 13,
            label: '${(prefs.readingScale * 100).round()}%',
            onChanged: controller.setReadingScale,
          ),
          AcademicSurface(
            backgroundColor:
                theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sample: Acceleration is the rate of change of velocity with respect to time.',
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.xs),
                RtlAwareText(
                  'اردو مضمون کے لیے دائیں سے بائیں متن کی معاونت فعال ہے۔',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),

          const StudyDivider(verticalPadding: AppSpacing.xl),

          StudySectionHeader(
            title: 'Privacy & Scope',
            subtitle:
                '${AppConstants.appName} • English Medium (Grades 9–12) • 100% Local MVP Progress',
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: () => context.push('/privacy'),
              child: const Text('Read Privacy Policy'),
            ),
          ),
        ],
      ),
    );
  }
}
