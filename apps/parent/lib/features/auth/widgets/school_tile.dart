import 'package:flutter/material.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// One school to open: its mark (the short name until logos are files, M4),
/// its name, and a note such as "Paused right now". With [onTap] null it is
/// shown but cannot be opened (a suspended school, spec 05).
class SchoolTile extends StatelessWidget {
  const new({
    required this.name,
    required this.shortName,
    required this.onTap,
    this.note,
    this.busy = false,
    super.key,
  });

  final String name;
  final String shortName;
  final String? note;
  final VoidCallback? onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final subtitle = note;
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: Material(
        color: c.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(QuadTokens.radiusCard),
          side: BorderSide(color: c.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: busy ? null : onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  SchoolMark(shortName: shortName, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: text.bodyLarge?.copyWith(
                            color: c.ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (subtitle != null)
                          Text(subtitle, style: text.bodyMedium),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (busy)
                    const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  else if (onTap != null)
                    ExcludeSemantics(
                      child: Icon(Icons.chevron_right, color: c.ink3),
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

/// A school's round mark: its short name on a neutral tile.
class SchoolMark extends StatelessWidget {
  const new({
    required this.shortName,
    required this.size,
    this.background,
    this.foreground,
    super.key,
  });

  final String shortName;
  final double size;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: background ?? c.surface2,
          shape: BoxShape.circle,
        ),
        child: FittedBox(
          child: Padding(
            padding: EdgeInsets.all(size * 0.18),
            child: Text(
              shortName,
              style: TextStyle(
                fontFamily: QuadTokens.fontDisplay,
                fontSize: size * 0.36,
                fontWeight: FontWeight.w800,
                color: foreground ?? c.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
