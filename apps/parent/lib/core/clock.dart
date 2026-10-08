import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'clock.g.dart';

/// Reads the current device time.
/// Tests override [clockProvider] with a fixed time.
typedef Clock = DateTime Function();

@Riverpod(keepAlive: true)
Clock clock(Ref ref) => DateTime.now;
