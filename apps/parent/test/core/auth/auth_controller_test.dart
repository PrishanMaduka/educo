import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';

import '../../helpers/auth_fakes.dart';

const _refresh = 'POST /api/v1/auth/refresh';
const _selectSchool = 'POST /api/v1/auth/select-school';
const _signOut = 'POST /api/v1/auth/sign-out';
const _verify = 'POST /api/v1/auth/otp/verify';
const _ping = 'GET /api/v1/ping';

const _unauthorized = FakeReply(401, {
  'code': 'unauthorized',
  'message': 'Sign in again.',
});

/// A family that rotates `r<n>` into `a<n+1>`/`r<n+1>` and accepts only the
/// newest access token on [_ping].
class _Family {
  int generation = 0;
  int refreshes = 0;
  Completer<void>? gate;
  Completer<void>? selectGate;

  /// Set to answer every refresh with this instead of rotating.
  FakeReply? refuse;

  late final api = FakeApi({
    _refresh: (request) async {
      refreshes++;
      await gate?.future;
      // Let parallel requests arrive while this refresh is in flight.
      await Future<void>.delayed(const Duration(milliseconds: 5));
      final refused = refuse;
      if (refused != null) return refused;
      if (bodyOf(request)['refreshToken'] != 'r$generation') {
        return _unauthorized;
      }
      generation++;
      return FakeReply(200, {
        'accessToken': 'a$generation',
        'refreshToken': 'r$generation',
      });
    },
    _ping: (request) => bearerOf(request) == 'Bearer a$generation'
        ? const FakeReply(200, {'ok': true})
        : _unauthorized,
    _selectSchool: (request) async {
      await selectGate?.future;
      return const FakeReply(200, {'accessToken': 'school'});
    },
    _signOut: (request) => const FakeReply(204),
  });
}

Map<String, Object?> _membership(String tenantId) => {
  'tenantId': tenantId,
  'name': 'Colombo International School',
  'shortName': 'CIS',
  'logoUrl': null,
  'brand': {
    'color': '#1F2A5A',
    'fill': '#1F2A5A',
    'fillDark': '#8C93D9',
    'ink': '#FFFFFF',
  },
  'suspended': false,
  'suspendReason': null,
  'kind': 'guardian',
};

void main() {
  late MemorySecureStore store;
  late _Family family;

  setUp(() {
    store = MemorySecureStore({SecureKey.refreshToken: 'r0'});
    family = _Family();
  });

  Future<ProviderContainer> signedIn({
    FakeApi? api,
    MemoryInstallMarker? installMarker,
  }) async {
    final container = authContainer(
      store: store,
      api: api ?? family.api,
      installMarker: installMarker,
    );
    await container.read(authControllerProvider.notifier).restored;
    return container;
  }

  Dio dioOf(ProviderContainer container) => container.read(quadApiProvider).dio;

  group('launch', () {
    test('a stored refresh token restores the session', () async {
      final container = await signedIn();

      expect(container.read(authControllerProvider), isA<SignedIn>());
      // The access token is never stored; it is fetched when first needed.
      expect(
        container.read(authControllerProvider.notifier).accessToken,
        isNull,
      );
    });

    test('a fresh install wipes a session left in the Keychain', () async {
      store.values[SecureKey.biometricsOn] = 'true';
      final marker = MemoryInstallMarker(installed: false);
      final container = await signedIn(installMarker: marker);

      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
      expect(marker.installed, isTrue);
    });

    test('an unreadable biometrics setting opens on the lock', () async {
      store.failReads.add(SecureKey.biometricsOn);
      final container = await signedIn();

      expect(container.read(authControllerProvider), isA<SignedIn>());
      expect(container.read(lockControllerProvider).locked, isTrue);
    });

    test('no refresh token means signed out', () async {
      store.values.clear();
      final container = await signedIn();

      expect(container.read(authControllerProvider), isA<SignedOut>());
    });
  });

  group('refresh on 401', () {
    test('three parallel 401s share one refresh and each retries', () async {
      final container = await signedIn();
      final dio = dioOf(container);
      // The first request refreshes to a1; then a1 expires.
      await dio.get<Object>('/api/v1/ping');
      family.api.routes[_ping] = (request) => bearerOf(request) == 'Bearer a2'
          ? const FakeReply(200, {'ok': true})
          : _unauthorized;
      family.refreshes = 0;

      final responses = await Future.wait([
        dio.get<Object>('/api/v1/ping'),
        dio.get<Object>('/api/v1/ping'),
        dio.get<Object>('/api/v1/ping'),
      ]);

      expect(family.refreshes, 1);
      expect(responses.map((r) => r.statusCode), [200, 200, 200]);
      expect(family.api.to(_ping).map(bearerOf).toList().sublist(1), [
        ...List.filled(3, 'Bearer a1'),
        ...List.filled(3, 'Bearer a2'),
      ]);
      expect(store.values[SecureKey.refreshToken], 'r2');
    });

    test(
      'stores the new refresh token before using the access token',
      () async {
        final container = await signedIn();
        final seen = <String?>[];
        family.api.routes[_ping] = (request) {
          seen.add(store.values[SecureKey.refreshToken]);
          return const FakeReply(200, {'ok': true});
        };

        await dioOf(container).get<Object>('/api/v1/ping');

        expect(seen, ['r1']);
      },
    );

    test(
      'the first request after launch refreshes before it is sent',
      () async {
        final container = await signedIn();

        final response = await dioOf(container).get<Object>('/api/v1/ping');

        expect(response.statusCode, 200);
        expect(family.api.to(_ping).map(bearerOf), ['Bearer a1']);
      },
    );

    test('the refresh itself carries no bearer token', () async {
      final container = await signedIn();

      await dioOf(container).get<Object>('/api/v1/ping');

      expect(family.api.to(_refresh).map(bearerOf), [null]);
      expect(bodyOf(family.api.to(_refresh).single), {'refreshToken': 'r0'});
    });

    test('a reused or revoked family signs out and wipes the store', () async {
      store.values[SecureKey.biometricsOn] = 'true';
      final container = await signedIn();
      await dioOf(container).get<Object>('/api/v1/ping');
      family
        ..refreshes = 0
        ..refuse = _unauthorized
        ..generation = 2;

      final results = await Future.wait([
        for (var i = 0; i < 3; i++)
          dioOf(container)
              .get<Object>('/api/v1/ping')
              .then<Object>((r) => r, onError: (Object e) => e),
      ]);

      expect(family.refreshes, 1);
      for (final result in results) {
        expect(result, isA<DioException>());
        expect((result as DioException).response?.statusCode, 401);
      }
      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
      expect(container.read(lockControllerProvider).biometricsOn, isFalse);
      expect(
        container.read(authControllerProvider.notifier).accessToken,
        isNull,
      );
    });

    test('a refresh that cannot reach the API keeps the session', () async {
      final container = await signedIn();
      family.refuse = const FakeReply(0);

      await expectLater(
        dioOf(container).get<Object>('/api/v1/ping'),
        throwsA(isA<DioException>()),
      );

      expect(container.read(authControllerProvider), isA<SignedIn>());
      expect(store.values[SecureKey.refreshToken], 'r0');
    });

    test('a refresh answered 400 keeps the session', () async {
      final container = await signedIn();
      family.refuse = const FakeReply(400, {
        'code': 'validation',
        'message': 'Check the highlighted fields.',
      });

      await expectLater(
        dioOf(container).get<Object>('/api/v1/ping'),
        throwsA(isA<DioException>()),
      );

      expect(container.read(authControllerProvider), isA<SignedIn>());
      expect(store.values[SecureKey.refreshToken], 'r0');
    });

    test('a rate-limited refresh keeps the session', () async {
      final container = await signedIn();
      family.refuse = const FakeReply(429, {
        'code': 'rate_limited',
        'message': 'Try again in a minute.',
      });

      await expectLater(
        dioOf(container).get<Object>('/api/v1/ping'),
        throwsA(isA<DioException>()),
      );

      expect(container.read(authControllerProvider), isA<SignedIn>());
      expect(store.values[SecureKey.refreshToken], 'r0');
    });

    test(
      'a refresh that breaks fails the request instead of hanging',
      () async {
        final container = await signedIn();
        store.failWrites = true;

        await expectLater(
          dioOf(container).get<Object>('/api/v1/ping'),
          throwsA(isA<DioException>()),
        );
      },
    );

    test('a request retried once is not refreshed again', () async {
      final container = await signedIn();
      family.api.routes[_ping] = (request) => _unauthorized;

      await expectLater(
        dioOf(container).get<Object>('/api/v1/ping'),
        throwsA(isA<DioException>()),
      );

      // The launch refresh, then one more for the 401; the retry's 401 ends it.
      expect(family.refreshes, 2);
      expect(family.api.to(_ping), hasLength(2));
    });
  });

  group('sign-in', () {
    test('a signed_in code stores the refresh token', () async {
      store.values.clear();
      family.api.routes[_verify] = (request) => const FakeReply(200, {
        'status': 'signed_in',
        'firstName': 'Dilhani',
        'memberships': <Object>[],
        'accessToken': 'a7',
        'refreshToken': 'r7',
      });
      final container = await signedIn();

      final result = await container
          .read(authControllerProvider.notifier)
          .verifyCode(OtpVerifyInput(phone: '+94770000001', code: '000000'));

      expect(result.status, OtpVerifyResultStatusEnum.signedIn);
      expect(container.read(authControllerProvider), isA<SignedIn>());
      expect(store.values[SecureKey.refreshToken], 'r7');
      expect(container.read(authControllerProvider.notifier).accessToken, 'a7');
    });

    test(
      'several schools wait for a choice, then select-school stores the pair',
      () async {
        store.values.clear();
        family.api.routes[_verify] = (request) => FakeReply(200, {
          'status': 'choose_school',
          'firstName': 'Ruwan',
          'memberships': [_membership('t1'), _membership('t2')],
          'accessToken': 'select',
        });
        family.api.routes[_selectSchool] = (request) =>
            const FakeReply(200, {'accessToken': 'a9', 'refreshToken': 'r9'});
        final container = await signedIn();
        final auth = container.read(authControllerProvider.notifier);

        await auth.verifyCode(OtpVerifyInput(email: 'r@x.test', code: '1'));
        final choosing = container.read(authControllerProvider);
        expect(choosing, isA<ChoosingSchool>());
        expect((choosing as ChoosingSchool).memberships, hasLength(2));
        expect(store.values, isEmpty);

        await auth.chooseSchool('t2');

        final request = family.api.to(_selectSchool).single;
        expect(bearerOf(request), 'Bearer select');
        expect(bodyOf(request)['tenantId'], 't2');
        expect(container.read(authControllerProvider), isA<SignedIn>());
        expect(store.values[SecureKey.refreshToken], 'r9');
        expect(auth.accessToken, 'a9');
      },
    );

    test('not_found leaves the parent signed out', () async {
      store.values.clear();
      family.api.routes[_verify] = (request) => const FakeReply(200, {
        'status': 'not_found',
        'memberships': <Object>[],
      });
      final container = await signedIn();

      await container
          .read(authControllerProvider.notifier)
          .verifyCode(OtpVerifyInput(phone: '+94770000009', code: '000000'));

      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
    });
  });

  group('switch school', () {
    test('waits for a refresh in flight and sends the new token', () async {
      final container = await signedIn();
      final auth = container.read(authControllerProvider.notifier);
      family.gate = Completer<void>();

      final refreshing = auth.refreshAfter(null);
      final switching = auth.switchSchool('t2');
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(family.api.to(_selectSchool), isEmpty);

      family.gate!.complete();
      await Future.wait([refreshing, switching]);

      final request = family.api.to(_selectSchool).single;
      expect(bearerOf(request), 'Bearer a1');
      expect(bodyOf(request)['tenantId'], 't2');
      expect(auth.accessToken, 'school');
      // A switch keeps the family's refresh token.
      expect(store.values[SecureKey.refreshToken], 'r1');
    });
  });

  group('sign out', () {
    test('revokes the family and wipes the store', () async {
      store.values[SecureKey.biometricsOn] = 'true';
      final container = await signedIn();
      final auth = container.read(authControllerProvider.notifier);
      await auth.refreshAfter(null);

      await auth.signOut();

      expect(family.api.to(_signOut).map(bearerOf), ['Bearer a1']);
      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
      expect(auth.accessToken, isNull);
    });

    test('waits for a refresh in flight and revokes with its token', () async {
      final container = await signedIn();
      final auth = container.read(authControllerProvider.notifier);
      await dioOf(container).get<Object>('/api/v1/ping');
      // a1 expires; a request's 401 starts a refresh that the gate holds.
      family.api.routes[_ping] = (request) => bearerOf(request) == 'Bearer a2'
          ? const FakeReply(200, {'ok': true})
          : _unauthorized;
      family.gate = Completer<void>();
      final request = dioOf(container).get<Object>('/api/v1/ping');
      await Future<void>.delayed(const Duration(milliseconds: 20));

      final signingOut = auth.signOut();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(family.api.to(_signOut), isEmpty);
      family.gate!.complete();
      await Future.wait([
        signingOut,
        request.catchError((Object _) => request),
      ]);

      expect(family.api.to(_signOut).map(bearerOf), ['Bearer a2']);
      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
      expect(auth.accessToken, isNull);
    });

    test('waits for a school switch and revokes with its token', () async {
      final container = await signedIn();
      final auth = container.read(authControllerProvider.notifier);
      await auth.refreshAfter(null);
      family.selectGate = Completer<void>();
      final switching = auth.switchSchool('t2');
      await Future<void>.delayed(const Duration(milliseconds: 20));

      final signingOut = auth.signOut();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(family.api.to(_signOut), isEmpty);
      family.selectGate!.complete();
      await Future.wait([switching, signingOut]);

      expect(family.api.to(_signOut).map(bearerOf), ['Bearer school']);
      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
      expect(auth.accessToken, isNull);
    });

    test('wipes the device even when the API cannot be reached', () async {
      final container = await signedIn();
      final auth = container.read(authControllerProvider.notifier);
      await auth.refreshAfter(null);
      family.api.routes[_signOut] = (request) => const FakeReply(0);

      await auth.signOut();

      expect(container.read(authControllerProvider), isA<SignedOut>());
      expect(store.values, isEmpty);
    });
  });
}
