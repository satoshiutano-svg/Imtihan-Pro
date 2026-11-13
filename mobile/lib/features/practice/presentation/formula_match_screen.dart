import 'package:flutter/material.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';

class _MatchPair {
  const _MatchPair(this.id, this.prompt, this.target);
  final String id;
  final String prompt;
  final String target;
}

/// Fast offline formula & SI-unit matching recall game.
class FormulaMatchScreen extends StatefulWidget {
  const FormulaMatchScreen({super.key});

  @override
  State<FormulaMatchScreen> createState() => _FormulaMatchScreenState();
}

class _FormulaMatchScreenState extends State<FormulaMatchScreen> {
  static const List<_MatchPair> _pairs = [
    _MatchPair('speed', 'Speed (v)', 'm s⁻¹ (Scalar)'),
    _MatchPair('accel', 'Acceleration (a)', '(vf - vi) / t (m s⁻²)'),
    _MatchPair('kc', 'Equilibrium Constant (Kc)', '[Products] / [Reactants]'),
    _MatchPair('coulomb', 'Coulomb Force (F)', 'k·q₁q₂ / r² (Newton)'),
  ];

  String? _selectedPromptId;
  final Set<String> _matchedIds = {};
  bool? _lastMatched;
  String? _feedback;

  void _tapTarget(_MatchPair targetPair) {
    if (_selectedPromptId == null || _matchedIds.contains(targetPair.id)) return;
    setState(() {
      if (_selectedPromptId == targetPair.id) {
        _matchedIds.add(targetPair.id);
        _lastMatched = true;
        _feedback = '${targetPair.prompt} ↔ ${targetPair.target}';
        _selectedPromptId = null;
      } else {
        _lastMatched = false;
        _feedback = 'Not a match — check the formula or SI unit carefully.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shuffledTargets = [_pairs[2], _pairs[0], _pairs[3], _pairs[1]];
    final allDone = _matchedIds.length == _pairs.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Formula & Unit Match')),
      body: StudyPageContainer(
        children: [
          const StudySectionHeader(
            kicker: '2-Minute Active Recall',
            title: 'Match Quantity to Formula / SI Unit',
            subtitle:
                'Tap a physical quantity on the left, then tap its matching formula or SI unit on the right.',
          ),
          const SizedBox(height: AppSpacing.md),
          if (_feedback != null) ...[
            StudyFeedbackBanner(
              kind: _lastMatched == true
                  ? StudyFeedbackKind.success
                  : StudyFeedbackKind.error,
              title: _lastMatched == true ? 'Matched' : 'Try Again',
              message: _feedback,
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final p in _pairs)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: OutlinedButton(
                          onPressed: _matchedIds.contains(p.id)
                              ? null
                              : () => setState(() => _selectedPromptId = p.id),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: _selectedPromptId == p.id
                                ? theme.colorScheme.primaryContainer
                                : null,
                            side: BorderSide(
                              color: _selectedPromptId == p.id
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.outline,
                            ),
                          ),
                          child: Text(p.prompt, textAlign: TextAlign.center),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final t in shuffledTargets)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: FilledButton.tonal(
                          onPressed: _matchedIds.contains(t.id)
                              ? null
                              : () => _tapTarget(t),
                          child: Text(t.target, textAlign: TextAlign.center),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (allDone) ...[
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => setState(() {
                  _matchedIds.clear();
                  _selectedPromptId = null;
                  _feedback = null;
                  _lastMatched = null;
                }),
                icon: const Icon(Icons.replay_outlined),
                label: const Text('Play Again'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
