import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/core/greeting.dart';

void main() {
  // Same bands as packages/domain greetingPeriod (spec 03, the greeting section).
  const cases = <(int, int, GreetingPeriod, GreetingWord)>[
    (4, 59, GreetingPeriod.night, GreetingWord.hello),
    (5, 0, GreetingPeriod.morning, GreetingWord.goodMorning),
    (11, 59, GreetingPeriod.morning, GreetingWord.goodMorning),
    (12, 0, GreetingPeriod.afternoon, GreetingWord.goodAfternoon),
    (16, 59, GreetingPeriod.afternoon, GreetingWord.goodAfternoon),
    (17, 0, GreetingPeriod.evening, GreetingWord.goodEvening),
    (19, 59, GreetingPeriod.evening, GreetingWord.goodEvening),
    (20, 0, GreetingPeriod.night, GreetingWord.goodEvening),
    (23, 59, GreetingPeriod.night, GreetingWord.goodEvening),
    (0, 0, GreetingPeriod.night, GreetingWord.hello),
  ];

  group('greetingAt', () {
    for (final (hour, minute, period, word) in cases) {
      final label =
          '${hour.toString().padLeft(2, '0')}:'
          '${minute.toString().padLeft(2, '0')}';
      test('at $label is ${period.name} with ${word.name}', () {
        final greeting = greetingAt(DateTime(2026, 10, 6, hour, minute));
        expect(greeting.period, period);
        expect(greeting.word, word);
      });
    }
  });
}
