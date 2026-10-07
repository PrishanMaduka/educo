import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'env.g.dart';

/// Where the build runs; the same names as the API's APP_ENV.
enum AppEnv { local, staging, production }

/// Build-time configuration from `--dart-define-from-file=env/<flavor>.json`.
@immutable
class Env {
  const Env({
    required this.appEnv,
    required this.apiUrl,
    required this.socketUrl,
    required this.sentryDsn,
  });

  /// Parses and checks one flavor file's values; throws [FormatException].
  factory Env.fromJson(Map<String, dynamic> values) {
    String read(String key) {
      final value = values[key];
      if (value is! String) {
        throw FormatException('$key is missing or not a string');
      }
      return value;
    }

    final appEnv = AppEnv.values.asNameMap()[read('APP_ENV')];
    if (appEnv == null) {
      throw FormatException(
        'APP_ENV must be one of ${AppEnv.values.map((e) => e.name)}',
      );
    }
    final secure = appEnv != AppEnv.local;
    return Env(
      appEnv: appEnv,
      apiUrl: _url(read('API_URL'), 'API_URL', secure ? {'https'} : _http),
      socketUrl: _url(read('SOCKET_URL'), 'SOCKET_URL', secure ? {'wss'} : _ws),
      sentryDsn: read('SENTRY_DSN'),
    );
  }

  /// The values compiled into this build.
  ///
  /// A debug or profile build without dart-defines (tests, a plain
  /// `flutter run`) gets the dev flavor's values, as in env/dev.json. A
  /// release build must be given its flavor file: [isRelease] defaults
  /// to [kReleaseMode] and makes a missing APP_ENV an error, so a store build
  /// can never point at localhost by accident.
  factory Env.fromDefines({bool isRelease = kReleaseMode}) {
    if (isRelease && !const bool.hasEnvironment('APP_ENV')) {
      throw StateError(
        'APP_ENV is not set. Build with '
        '--dart-define-from-file=env/<flavor>.json.',
      );
    }
    return Env.fromJson(const {
      'APP_ENV': String.fromEnvironment('APP_ENV', defaultValue: 'local'),
      'API_URL': String.fromEnvironment(
        'API_URL',
        defaultValue: 'http://localhost:4000/api/v1',
      ),
      'SOCKET_URL': String.fromEnvironment(
        'SOCKET_URL',
        defaultValue: 'ws://localhost:4000',
      ),
      'SENTRY_DSN': String.fromEnvironment('SENTRY_DSN'),
    });
  }

  static const _http = {'http', 'https'};
  static const _ws = {'ws', 'wss'};

  static Uri _url(String value, String key, Set<String> schemes) {
    final uri = Uri.tryParse(value);
    if (uri == null || !schemes.contains(uri.scheme) || uri.host.isEmpty) {
      throw FormatException('$key must be a ${schemes.join(' or ')} URL');
    }
    return uri;
  }

  final AppEnv appEnv;
  final Uri apiUrl;
  final Uri socketUrl;

  /// Empty turns error reporting off.
  final String sentryDsn;

  @override
  bool operator ==(Object other) =>
      other is Env &&
      other.appEnv == appEnv &&
      other.apiUrl == apiUrl &&
      other.socketUrl == socketUrl &&
      other.sentryDsn == sentryDsn;

  @override
  int get hashCode => Object.hash(appEnv, apiUrl, socketUrl, sentryDsn);
}

/// Overridden in main() with the values checked at start-up.
@Riverpod(keepAlive: true)
Env env(Ref ref) => Env.fromDefines();
