import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/app.dart';
import 'package:quad_parent/core/clock.dart';

/// Monday 5 October 2026, 08:15 on the device: a morning greeting.
final mondayMorning = DateTime(2026, 10, 5, 8, 15);

/// The whole app with a fixed clock.
Widget appAt(DateTime now) => ProviderScope(
  overrides: [clockProvider.overrideWithValue(() => now)],
  child: const QuadApp(),
);
