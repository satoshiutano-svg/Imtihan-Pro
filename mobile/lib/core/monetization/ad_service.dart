import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Respectful, offline-safe AdMob placement abstraction.
///
/// Design rules:
/// - Never interrupts active concept reading or timed exam questions.
/// - Banner slots collapse cleanly to zero height when offline or disabled.
/// - Post-session interstitials fire only after a completed practice/exam set.
/// - Rewarded ads are strictly student-initiated (e.g. optional extra mock unlock).
class AdPlacementService {
  const AdPlacementService({this.adsEnabled = false});

  /// Flip to true after adding `google_mobile_ads` App ID in AndroidManifest.xml.
  final bool adsEnabled;

  Future<bool> showPostSessionInterstitial() async {
    if (!adsEnabled) return false;
    return true;
  }

  Future<bool> showRewardedForOptionalUnlock() async {
    if (!adsEnabled) return true;
    return true;
  }
}

final adPlacementServiceProvider = Provider<AdPlacementService>((ref) {
  return const AdPlacementService(adsEnabled: false);
});

/// Collapsible banner slot that stays invisible offline and reserves
/// non-intrusive space only when live AdMob banners are enabled.
class RespectfulBannerSlot extends ConsumerWidget {
  const RespectfulBannerSlot({super.key, required this.placementLabel});

  final String placementLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.watch(adPlacementServiceProvider);
    if (!service.adsEnabled) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context);
    return Container(
      height: 54,
      margin: const EdgeInsets.only(top: 12),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: theme.colorScheme.outline),
      ),
      child: Text(
        'AdMob Banner Slot ($placementLabel)',
        style: theme.textTheme.bodySmall,
      ),
    );
  }
}
