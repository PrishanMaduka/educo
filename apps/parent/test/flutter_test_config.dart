import 'dart:async';

import 'helpers/fonts.dart';

/// Runs before every test file: real fonts so goldens show Figtree, not Ahem.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  await loadAppFonts();
  await testMain();
}
