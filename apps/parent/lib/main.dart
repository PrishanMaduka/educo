import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/app.dart';
import 'package:quad_parent/core/env.dart';

void main() {
  // Check the flavor's values first, so a bad build fails at launch.
  final env = Env.fromDefines();
  LicenseRegistry.addLicense(() async* {
    yield LicenseEntryWithLineBreaks([
      'Figtree',
    ], await rootBundle.loadString('assets/fonts/OFL.txt'));
  });
  runApp(
    ProviderScope(
      overrides: [envProvider.overrideWithValue(env)],
      child: const QuadApp(),
    ),
  );
}
