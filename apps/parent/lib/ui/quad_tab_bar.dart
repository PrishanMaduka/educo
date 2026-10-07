import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:quad_parent/theme/theme.dart';

/// One tab: its label and the SVG asset of its icon.
typedef QuadTab = ({String label, String icon});

/// The parent app's bottom tab bar: the active tab is a coral pill with a
/// small dot (design/parent.html `.tabbar`). The pill and the active label use
/// brand-fill, not brand, so white icons on the pill and the label on the
/// surface both reach 4.5:1 (ruling R16).
class QuadTabBar extends StatelessWidget {
  const new({
    required this.tabs,
    required this.currentIndex,
    required this.onSelect,
    required this.semanticLabel,
    super.key,
  });

  final List<QuadTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  /// Names the navigation region for screen readers.
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: semanticLabel,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          border: Border(top: BorderSide(color: c.line)),
          boxShadow: [
            BoxShadow(
              color: c.ink.withValues(alpha: 0.35),
              blurRadius: 24,
              spreadRadius: -18,
              offset: const Offset(0, -10),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(6, 8, 6, 0),
            // Labels grow with the text size up to 1.3x; beyond that the
            // longer labels ("Payments", "Messages") run into each other.
            child: MediaQuery.withClampedTextScaling(
              maxScaleFactor: 1.3,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (i, tab) in tabs.indexed)
                    Expanded(
                      child: _TabButton(
                        tab: tab,
                        active: i == currentIndex,
                        onTap: () => onSelect(i),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const new({required this.tab, required this.active, required this.onTap});

  final QuadTab tab;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final labelStyle = Theme.of(context).textTheme.labelSmall!;
    return Semantics(
      container: true,
      button: true,
      selected: active,
      label: tab.label,
      onTap: onTap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 250),
                curve: const Cubic(0.2, 0.8, 0.2, 1),
                width: 54,
                height: 30,
                decoration: BoxDecoration(
                  color: active ? c.brandFill : c.surface.withValues(alpha: 0),
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: active
                      ? [
                          BoxShadow(
                            color: c.brandFill,
                            blurRadius: 14,
                            spreadRadius: -8,
                            offset: const Offset(0, 6),
                          ),
                        ]
                      : const [],
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SvgPicture.asset(
                      tab.icon,
                      width: 21,
                      height: 21,
                      colorFilter: ColorFilter.mode(
                        active ? c.brandInk : c.ink3,
                        BlendMode.srcIn,
                      ),
                    ),
                    if (active)
                      Positioned(
                        top: 3,
                        right: 9,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: c.gold,
                            border: Border.all(color: c.brandFill, width: 1.5),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 3),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    tab.label,
                    maxLines: 1,
                    style: labelStyle.copyWith(
                      color: active ? c.brandFill : c.ink3,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
