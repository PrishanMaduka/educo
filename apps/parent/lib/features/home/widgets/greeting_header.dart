import 'package:flutter/material.dart';
import 'package:quad_parent/core/format.dart';
import 'package:quad_parent/core/greeting.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/ui/greeting_icon.dart';

/// Home's greeting: the time-of-day icon with the date, then the greeting
/// word (spec 09, Home 1). The parent's first name joins it with parent
/// sign-in (M6).
class GreetingHeader extends StatelessWidget {
  const new({required this.now, super.key});

  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final greeting = greetingAt(now);
    final word = switch (greeting.word) {
      GreetingWord.goodMorning => l10n.greetingMorning,
      GreetingWord.goodAfternoon => l10n.greetingAfternoon,
      GreetingWord.goodEvening => l10n.greetingEvening,
      GreetingWord.hello => l10n.greetingHello,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            GreetingIcon(period: greeting.period),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                formatDayDate(now, l10n.localeName),
                style: text.labelMedium,
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Semantics(header: true, child: Text(word, style: text.headlineSmall)),
      ],
    );
  }
}
