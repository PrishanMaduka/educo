import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/features/auth/screens/code_screen.dart';

void main() {
  for (final (typed, shown) in [
    ('+94 77 000 0001', '+94 •• ••• 0001'),
    ('+94 770000001', '+94 •••••0001'),
    ('+94 0001', '+94 0001'),
    ('770000001', '770000001'),
  ]) {
    test('shows $typed as $shown', () => expect(maskPhone(typed), shown));
  }
}
