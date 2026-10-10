import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/app.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/clock.dart';
import 'package:quad_parent/core/install_marker.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';

import 'auth_fakes.dart';

/// Monday 5 October 2026, 08:15 on the device: a morning greeting.
final mondayMorning = DateTime(2026, 10, 5, 8, 15);

/// A device that signed in earlier, with biometrics off.
MemorySecureStore signedInStore() =>
    MemorySecureStore({SecureKey.refreshToken: 'r0'});

/// The whole app with a fixed clock, signed in unless [store] says otherwise.
Widget appAt(DateTime now, {MemorySecureStore? store, FakeApi? api}) =>
    appWith(clock: FakeClock(now), store: store ?? signedInStore(), api: api);

/// The whole app with a clock the test moves and fakes at the edges: the
/// HTTP client answers from [api] (404 for every route by default, so a
/// signed-in launch keeps Quad's brand and nothing reaches the network).
Widget appWith({
  required FakeClock clock,
  required MemorySecureStore store,
  FakeLocalAuth? localAuth,
  FakeApi? api,
}) {
  final container = ProviderContainer(
    overrides: [
      clockProvider.overrideWithValue(() => clock.now),
      secureStoreProvider.overrideWithValue(store),
      installMarkerProvider.overrideWithValue(MemoryInstallMarker()),
      localAuthProvider.overrideWithValue(localAuth ?? FakeLocalAuth()),
    ],
  );
  addTearDown(container.dispose);
  container.read(quadApiProvider).dio.httpClientAdapter =
      api ?? FakeApi(const {});
  return UncontrolledProviderScope(
    container: container,
    child: const QuadApp(),
  );
}
