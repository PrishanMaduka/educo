import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';

import '../../helpers/auth_fakes.dart';

void main() {
  late MemorySecureStore store;
  late FakeClock clock;
  late FakeLocalAuth localAuth;

  setUp(() {
    store = MemorySecureStore({SecureKey.biometricsOn: 'true'});
    clock = FakeClock(DateTime.utc(2026, 10, 5, 8));
    localAuth = FakeLocalAuth();
  });

  Future<ProviderContainer> launched() async {
    final container = authContainer(
      store: store,
      clock: clock,
      localAuth: localAuth,
    );
    await container.read(lockControllerProvider.notifier).restoreAtLaunch();
    return container;
  }

  bool lockedIn(ProviderContainer c) => c.read(lockControllerProvider).locked;

  test('locks at launch with biometrics on', () async {
    expect(lockedIn(await launched()), isTrue);
  });

  test('does not lock at launch with biometrics off', () async {
    store.values.clear();
    expect(lockedIn(await launched()), isFalse);
  });

  group('after the background (spec 09 Re-lock)', () {
    Future<ProviderContainer> unlockedThenAway(Duration away) async {
      final container = await launched();
      final lock = container.read(lockControllerProvider.notifier);
      await lock.unlock(reason: 'Unlock Quad');
      expect(lockedIn(container), isFalse);
      lock.paused();
      clock.advance(away);
      lock.resumed();
      return container;
    }

    test('locks after 5:01 paused', () async {
      final container = await unlockedThenAway(
        const Duration(minutes: 5, seconds: 1),
      );
      expect(lockedIn(container), isTrue);
    });

    test('stays open after 4:59 paused', () async {
      final container = await unlockedThenAway(
        const Duration(minutes: 4, seconds: 59),
      );
      expect(lockedIn(container), isFalse);
    });

    test('stays open at exactly 5:00 (more than 5 minutes locks)', () async {
      final container = await unlockedThenAway(const Duration(minutes: 5));
      expect(lockedIn(container), isFalse);
    });

    test('measures from the first pause', () async {
      final container = await launched();
      final lock = container.read(lockControllerProvider.notifier);
      await lock.unlock(reason: 'Unlock Quad');
      lock.paused();
      clock.advance(const Duration(minutes: 3));
      lock.paused();
      clock.advance(const Duration(minutes: 2, seconds: 1));
      lock.resumed();

      expect(lockedIn(container), isTrue);
    });

    test('a resume without a pause changes nothing', () async {
      final container = await launched();
      final lock = container.read(lockControllerProvider.notifier);
      await lock.unlock(reason: 'Unlock Quad');
      clock.advance(const Duration(hours: 1));
      lock.resumed();

      expect(lockedIn(container), isFalse);
    });

    test('never locks with biometrics off', () async {
      store.values.clear();
      final container = await launched();
      final lock = container.read(lockControllerProvider.notifier)..paused();
      clock.advance(const Duration(hours: 1));
      lock.resumed();

      expect(lockedIn(container), isFalse);
    });
  });

  group('unlock', () {
    test('passes the reason to the system prompt', () async {
      final container = await launched();

      final ok = await container
          .read(lockControllerProvider.notifier)
          .unlock(reason: 'Unlock Quad');

      expect(ok, isTrue);
      expect(localAuth.reasons, ['Unlock Quad']);
    });

    test('stays locked when the prompt fails', () async {
      localAuth.result = false;
      final container = await launched();

      final ok = await container
          .read(lockControllerProvider.notifier)
          .unlock(reason: 'Unlock Quad');

      expect(ok, isFalse);
      expect(lockedIn(container), isTrue);
    });

    test('stays locked when the parent cancels the prompt', () async {
      localAuth.error = const LocalAuthException(
        code: LocalAuthExceptionCode.userCanceled,
      );
      final container = await launched();

      final ok = await container
          .read(lockControllerProvider.notifier)
          .unlock(reason: 'Unlock Quad');

      expect(ok, isFalse);
      expect(lockedIn(container), isTrue);
    });
  });

  test('turning biometrics on stores it without locking now', () async {
    store.values.clear();
    final container = await launched();

    await container
        .read(lockControllerProvider.notifier)
        .setBiometricsOn(on: true);

    expect(store.values[SecureKey.biometricsOn], 'true');
    expect(container.read(lockControllerProvider).biometricsOn, isTrue);
    expect(lockedIn(container), isFalse);
  });
}
