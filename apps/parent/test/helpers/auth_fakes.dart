import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_platform_interface/local_auth_platform_interface.dart'
    show AuthMessages;
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/cache_wipe.dart';
import 'package:quad_parent/core/clock.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';

/// [SecureStore] in memory.
class MemorySecureStore implements SecureStore {
  new([Map<SecureKey, String>? values]) : values = {...?values};

  final Map<SecureKey, String> values;

  /// Makes [write] throw, as a locked Keychain would.
  bool failWrites = false;

  @override
  Future<String?> read(SecureKey key) async => values[key];

  @override
  Future<void> write(SecureKey key, String value) async {
    if (failWrites) throw StateError('The secure store is unavailable.');
    values[key] = value;
  }

  @override
  Future<void> delete(SecureKey key) async => values.remove(key);

  @override
  Future<void> wipe() async => values.clear();
}

/// One answer from [FakeApi].
class FakeReply {
  const new(this.status, [this.json]);

  final int status;
  final Object? json;
}

typedef FakeRoute = FutureOr<FakeReply> Function(RequestOptions request);

/// Answers the generated client's requests by `'<METHOD> <path>'` and keeps
/// every request it saw.
class FakeApi implements HttpClientAdapter {
  new(this.routes);

  final Map<String, FakeRoute> routes;
  final List<RequestOptions> requests = [];

  Iterable<RequestOptions> to(String route) =>
      requests.where((r) => '${r.method} ${r.uri.path}' == route);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final route = routes['${options.method} ${options.uri.path}'];
    final reply = route == null ? const FakeReply(404) : await route(options);
    if (reply.status == 0) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    return ResponseBody.fromString(
      reply.json == null ? '' : jsonEncode(reply.json),
      reply.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// The JSON body a request sent.
Map<String, dynamic> bodyOf(RequestOptions request) =>
    jsonDecode(request.data as String) as Map<String, dynamic>;

String? bearerOf(RequestOptions request) =>
    request.headers['Authorization'] as String?;

/// [LocalAuthentication] that answers with [result], or throws [error].
class FakeLocalAuth extends Fake implements LocalAuthentication {
  new({this.result = true});

  bool result;
  Exception? error;
  final List<String> reasons = [];

  @override
  Future<bool> authenticate({
    required String localizedReason,
    Iterable<AuthMessages> authMessages = const <AuthMessages>[],
    bool biometricOnly = false,
    bool sensitiveTransaction = true,
    bool persistAcrossBackgrounding = false,
  }) async {
    reasons.add(localizedReason);
    final failure = error;
    if (failure != null) throw failure;
    return result;
  }
}

/// A clock the test moves by hand.
class FakeClock {
  new(this.now);

  DateTime now;

  void advance(Duration by) => now = now.add(by);
}

/// The app's providers with fakes at the edges: secure storage, HTTP, the
/// biometric prompt and the clock.
ProviderContainer authContainer({
  required MemorySecureStore store,
  FakeApi? api,
  FakeLocalAuth? localAuth,
  FakeClock? clock,
}) {
  final container = ProviderContainer(
    overrides: [
      secureStoreProvider.overrideWithValue(store),
      localAuthProvider.overrideWithValue(localAuth ?? FakeLocalAuth()),
      if (clock != null) clockProvider.overrideWithValue(() => clock.now),
      // Plain unit tests have no Flutter binding, so no image cache.
      cacheWipeProvider.overrideWithValue(() async {}),
    ],
  );
  addTearDown(container.dispose);
  container.read(quadApiProvider).dio.httpClientAdapter =
      api ?? FakeApi(const {});
  return container;
}
