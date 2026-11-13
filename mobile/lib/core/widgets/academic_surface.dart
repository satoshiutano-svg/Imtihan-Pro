import 'package:flutter/material.dart';
import 'package:roshan_study/app/theme/app_colors.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';

/// Lightweight flat bordered container reserved for distinct focal blocks,
/// interactive rows, or grouped panels — avoiding heavy shadows and GPU bloat.
class AcademicSurface extends StatelessWidget {
  const AcademicSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.onTap,
    this.backgroundColor,
    this.borderColor,
    this.showBorder = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? borderColor;
  final bool showBorder;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      side: showBorder
          ? BorderSide(
              color: borderColor ?? theme.colorScheme.outline,
              width: 1,
            )
          : BorderSide.none,
    );

    return Material(
      color: backgroundColor ?? theme.colorScheme.surface,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: onTap != null
          ? InkWell(
              onTap: onTap,
              child: Padding(padding: padding, child: child),
            )
          : Padding(padding: padding, child: child),
    );
  }
}

/// Consistent page padding, safe area bottom handling, and readable line-width
/// cap for phones and tablets.
class StudyPageContainer extends StatelessWidget {
  const StudyPageContainer({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.fromLTRB(
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.xl,
    ),
    this.controller,
  });

  final List<Widget> children;
  final EdgeInsetsGeometry padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        controller: controller,
        padding: padding,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AppTouchTarget.maxContentWidth,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ),
    );
  }
}

/// Clean unboxed section header so screens breathe with whitespace and dividers
/// instead of boxing every paragraph into a separate card.
class StudySectionHeader extends StatelessWidget {
  const StudySectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.kicker,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final String? kicker;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (kicker != null && kicker!.isNotEmpty) ...[
                Text(
                  kicker!.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
              ],
              Text(title, style: theme.textTheme.titleMedium),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(subtitle!, style: theme.textTheme.bodySmall),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: AppSpacing.sm),
          trailing!,
        ],
      ],
    );
  }
}

/// Hairline horizontal divider with consistent vertical breathing room.
class StudyDivider extends StatelessWidget {
  const StudyDivider({super.key, this.verticalPadding = AppSpacing.lg});

  final double verticalPadding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: verticalPadding),
      child: const Divider(height: 1),
    );
  }
}

/// Quiet, unboxed inline metadata separated by bullets instead of decorative
/// pill chips.
class StudyMetadataLine extends StatelessWidget {
  const StudyMetadataLine({
    super.key,
    required this.parts,
    this.style,
  });

  final List<String> parts;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final clean = parts.where((p) => p.trim().isNotEmpty).toList(growable: false);
    return Text(
      clean.join(' • '),
      style: style ?? Theme.of(context).textTheme.bodySmall,
    );
  }
}

enum StudyFeedbackKind { success, error, warning, info }

/// Dual-coded semantic feedback banner pairing an accessible icon and color
/// container with plain text—never relying on color alone.
class StudyFeedbackBanner extends StatelessWidget {
  const StudyFeedbackBanner({
    super.key,
    required this.kind,
    required this.title,
    this.message,
  });

  final StudyFeedbackKind kind;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    late final Color fg;
    late final Color bg;
    late final IconData icon;

    switch (kind) {
      case StudyFeedbackKind.success:
        fg = isDark ? AppColors.correctDark : AppColors.correctLight;
        bg = isDark
            ? AppColors.correctContainerDark
            : AppColors.correctContainerLight;
        icon = Icons.check_circle_outline;
        break;
      case StudyFeedbackKind.error:
        fg = isDark ? AppColors.errorDark : AppColors.errorLight;
        bg = isDark ? AppColors.errorContainerDark : AppColors.errorContainerLight;
        icon = Icons.error_outline;
        break;
      case StudyFeedbackKind.warning:
        fg = isDark
            ? AppColors.revisionWarningDark
            : AppColors.revisionWarningLight;
        bg = isDark
            ? AppColors.revisionWarningContainerDark
            : AppColors.revisionWarningContainerLight;
        icon = Icons.schedule_outlined;
        break;
      case StudyFeedbackKind.info:
        fg = isDark ? AppColors.noteInfoDark : AppColors.noteInfoLight;
        bg = isDark
            ? AppColors.noteInfoContainerDark
            : AppColors.noteInfoContainerLight;
        icon = Icons.info_outline;
        break;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: fg.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: AppIconSize.md, color: fg),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.labelLarge?.copyWith(color: fg),
                ),
                if (message != null && message!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(message!, style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Calm, actionable empty state ensuring students always know what to do next.
class StudyEmptyState extends StatelessWidget {
  const StudyEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.lg,
        horizontal: AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: AppIconSize.lg,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(title, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xxs),
          Text(message, style: theme.textTheme.bodyMedium),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.sm),
            FilledButton(
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
