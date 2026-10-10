import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/app.dart';
import 'package:quad_parent/core/env.dart';
import 'package:quad_parent/core/sentry.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> main() async {
  // Check the flavor's values first, so a bad build fails at launch.
  final env = Env.fromDefines();
  LicenseRegistry.addLicense(() async* {
    yield LicenseEntryWithLineBreaks([
      'Figtree',
    ], await rootBundle.loadString('assets/fonts/OFL-Figtree.txt'));
    yield LicenseEntryWithLineBreaks([
      'Bricolage Grotesque',
    ], await rootBundle.loadString('assets/fonts/OFL-BricolageGrotesque.txt'));
  });
  void run() => runApp(
    ProviderScope(
      overrides: [envProvider.overrideWithValue(env)],
      child: const QuadApp(),
    ),
  );

  // Sentry starts only when the flavor gives a DSN (spec 02, D21).
  final sentry = sentryOptionsFor(env);
  if (sentry == null) {
    run();
  } else {
    await SentryFlutter.init(
      (options) => applySentryConfig(options, sentry),
      appRunner: run,
    );
  }
}
