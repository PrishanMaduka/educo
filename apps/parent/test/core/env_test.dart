import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/env.dart';

Map<String, dynamic> _flavor(String name) =>
    json.decode(File('env/$name.json').readAsStringSync())
        as Map<String, dynamic>;

void main() {
  group('env/<flavor>.json', () {
    const expected = {
      'dev': (
        AppEnv.local,
        'http://localhost:4000/api/v1',
        'ws://localhost:4000',
      ),
      'staging': (
        AppEnv.staging,
        'https://staging.quad-edu.com/api/v1',
        'wss://staging.quad-edu.com/socket.io',
      ),
      'prod': (
        AppEnv.production,
        'https://quad-edu.com/api/v1',
        'wss://quad-edu.com/socket.io',
      ),
    };

    for (final MapEntry(key: flavor, value: (appEnv, apiUrl, socketUrl))
        in expected.entries) {
      test('$flavor has exactly the four keys and parses', () {
        final values = _flavor(flavor);
        expect(
          values.keys,
          unorderedEquals(['APP_ENV', 'API_URL', 'SOCKET_URL', 'SENTRY_DSN']),
        );
        final env = Env.fromJson(values);
        expect(env.appEnv, appEnv);
        expect(env.apiUrl, Uri.parse(apiUrl));
        expect(env.socketUrl, Uri.parse(socketUrl));
        expect(env.sentryDsn, isEmpty);
      });
    }
  });

  test('a debug build without --dart-define-from-file uses dev', () {
    expect(Env.fromDefines(), Env.fromJson(_flavor('dev')));
  });

  test('a release build without --dart-define-from-file refuses to start', () {
    // Tests run without dart-defines, so APP_ENV is undefined here.
    expect(
      () => Env.fromDefines(isRelease: true),
      throwsA(
        isA<StateError>().having(
          (e) => e.message,
          'message',
          contains('--dart-define-from-file=env/<flavor>.json'),
        ),
      ),
    );
  });

  group('Env.fromJson refuses bad values', () {
    Map<String, dynamic> devWith(String key, String value) => {
      ..._flavor('dev'),
      key: value,
    };

    test('an unknown APP_ENV', () {
      expect(
        () => Env.fromJson(devWith('APP_ENV', 'qa')),
        throwsA(isA<FormatException>()),
      );
    });

    test('an API_URL that is not http(s)', () {
      expect(
        () => Env.fromJson(devWith('API_URL', 'localhost:4000')),
        throwsA(isA<FormatException>()),
      );
    });

    test('plain http or ws in staging', () {
      final staging = _flavor('staging');
      expect(
        () => Env.fromJson({
          ...staging,
          'API_URL': 'http://staging.quad-edu.com',
        }),
        throwsA(isA<FormatException>()),
      );
      expect(
        () => Env.fromJson({
          ...staging,
          'SOCKET_URL': 'ws://staging.quad-edu.com',
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('plain http outside local', () {
      final prod = {
        ..._flavor('prod'),
        'API_URL': 'http://quad-edu.com/api/v1',
      };
      expect(() => Env.fromJson(prod), throwsA(isA<FormatException>()));
    });

    test('a SOCKET_URL that is not ws(s)', () {
      expect(
        () => Env.fromJson(devWith('SOCKET_URL', 'http://localhost:4000')),
        throwsA(isA<FormatException>()),
      );
    });

    test('a missing key', () {
      final values = _flavor('dev')..remove('API_URL');
      expect(() => Env.fromJson(values), throwsA(isA<FormatException>()));
    });
  });

  test('the API client talks to the API_URL origin', () {
    // The generated client's paths already start with /api/v1.
    final container = ProviderContainer(
      overrides: [envProvider.overrideWithValue(Env.fromJson(_flavor('prod')))],
    );
    addTearDown(container.dispose);
    expect(
      container.read(quadApiProvider).dio.options.baseUrl,
      'https://quad-edu.com',
    );
  });
}
