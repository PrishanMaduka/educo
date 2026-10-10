import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:quad_parent/core/auth/token_interceptor.dart';
import 'package:quad_parent/core/cache_wipe.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_controller.g.dart';

/// The parent's session (spec 05 Parent app, spec 09 Cache security).
///
/// The refresh token lives in [SecureStore]; the access token only in memory.
/// Refreshes are single flight, and a refresh and a school switch never
/// overlap: the API has no grace window, so presenting a rotated-out refresh
/// token even once revokes the whole family (D32). A refused refresh (reuse,
/// revocation, or a family past its 60 days) signs out and wipes the device.
@Riverpod(keepAlive: true)
class AuthController extends _$AuthController implements AccessTokens {
  static const Map<String, Object> _public = {TokenInterceptor.skipAuth: true};

  String? _accessToken;
  String? _selectToken;
  Future<String?>? _refreshing;
  Future<void> _tail = Future.value();

  /// Bumped whenever a session starts or ends, so an answer that arrives for
  /// an older session is dropped.
  int _epoch = 0;
  late Future<void> _restored;

  @override
  AuthState build() {
    _restored = _restore();
    return const AuthRestoring();
  }

  /// Completes once launch has read the device's session.
  Future<void> get restored => _restored;

  @override
  String? get accessToken => _accessToken;

  @override
  bool get canRefresh => state is SignedIn;

  @override
  Future<String?> refreshAfter(String? rejected) {
    if (state is! SignedIn) return Future.value();
    final current = _accessToken;
    if (current != null && current != rejected) return Future.value(current);
    return _refreshing ??= _exclusive(() => _refresh(rejected))
        .whenComplete(() => _refreshing = null);
  }

  /// Checks the sign-in code. `signed_in` starts the session; `choose_school`
  /// keeps the 5-minute `select_school` token in memory for [chooseSchool].
  /// API errors (such as 400 `invalid_code`) are the caller's to show.
  Future<OtpVerifyResult> verifyCode(OtpVerifyInput input) async {
    final response = await _auth.apiV1AuthOtpVerifyPost(
      otpVerifyInput: input,
      extra: _public,
    );
    final result = _body(response);
    switch (result.status) {
      case OtpVerifyResultStatusEnum.signedIn:
        await _begin(
          accessToken: _present(result.accessToken),
          refreshToken: _present(result.refreshToken),
        );
      case OtpVerifyResultStatusEnum.chooseSchool:
        _epoch++;
        _selectToken = _present(result.accessToken);
        state = ChoosingSchool(
          firstName: result.firstName,
          memberships: result.memberships,
        );
      case OtpVerifyResultStatusEnum.notFound:
        state = const SignedOut();
    }
    return result;
  }

  /// Opens [tenantId] with the `select_school` token from [verifyCode]. A
  /// 401 means the 5-minute choice ran out: back to signed out.
  Future<void> chooseSchool(String tenantId) async {
    final selectToken = _selectToken;
    if (state is! ChoosingSchool || selectToken == null) {
      throw StateError('There is no school to choose.');
    }
    final SelectSchoolTokens tokens;
    try {
      tokens = await _selectSchool(tenantId, selectToken);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        _selectToken = null;
        state = const SignedOut();
      }
      rethrow;
    }
    await _begin(
      accessToken: tokens.accessToken,
      refreshToken: _present(tokens.refreshToken),
    );
  }

  /// Switch school: the family moves to [tenantId] and gets a new access
  /// token; the refresh token stays. The previous school's cache is wiped
  /// before the new token is used (spec 09).
  Future<void> switchSchool(String tenantId) => _exclusive(() async {
    var token = _accessToken ?? await _refresh(null);
    if (token == null) throw StateError('There is no session to switch.');
    SelectSchoolTokens tokens;
    try {
      tokens = await _selectSchool(tenantId, token);
    } on DioException catch (error) {
      if (error.response?.statusCode != 401) rethrow;
      token = await _refresh(token);
      if (token == null) rethrow;
      tokens = await _selectSchool(tenantId, token);
    }
    final refreshToken = tokens.refreshToken;
    if (refreshToken != null) {
      await _store.write(SecureKey.refreshToken, refreshToken);
    }
    await ref.read(cacheWipeProvider)();
    _accessToken = tokens.accessToken;
  });

  /// Revokes this device's family (and, from M6, its push token), then wipes
  /// the device (spec 05 step 7).
  Future<void> signOut() async {
    final token = _accessToken ?? await refreshAfter(null);
    if (token != null) {
      try {
        await _auth.apiV1AuthSignOutPost(
          headers: {'Authorization': 'Bearer $token'},
          extra: _public,
        );
      } on DioException {
        // Offline, or the family is already revoked: this device forgets it
        // anyway, and the family ends by itself after 60 days.
      }
    }
    await _end();
  }

  AuthApi get _auth => ref.read(quadApiProvider).getAuthApi();

  SecureStore get _store => ref.read(secureStoreProvider);

  Future<void> _restore() async {
    String? refreshToken;
    try {
      refreshToken = await _store.read(SecureKey.refreshToken);
    } on PlatformException {
      // The Keychain or Keystore could not be read (a restored backup, a
      // reset lock screen): sign in again.
      refreshToken = null;
    }
    if (refreshToken == null) {
      state = const SignedOut();
      return;
    }
    await ref.read(lockControllerProvider.notifier).restoreAtLaunch();
    state = const SignedIn();
  }

  /// One refresh, run inside [_exclusive].
  Future<String?> _refresh(String? rejected) async {
    // A refresh or switch that finished while this one waited already did it.
    final current = _accessToken;
    if (current != null && current != rejected) return current;
    final epoch = _epoch;
    final refreshToken = await _store.read(SecureKey.refreshToken);
    if (refreshToken == null) {
      await _end();
      return null;
    }
    final TokenPair pair;
    try {
      pair = _body(
        await _auth.apiV1AuthRefreshPost(
          refreshInput: RefreshInput(refreshToken: refreshToken),
          extra: _public,
        ),
      );
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      // 401: reused, revoked or expired; 400: a token the API cannot read.
      // Anything else (offline, 429, 5xx) keeps the session for a retry.
      if ((status == 401 || status == 400) && epoch == _epoch) await _end();
      return null;
    }
    if (epoch != _epoch) return null;
    // Stored before it is used, so a crash never leaves the old one behind.
    await _store.write(SecureKey.refreshToken, pair.refreshToken);
    _accessToken = pair.accessToken;
    return pair.accessToken;
  }

  Future<SelectSchoolTokens> _selectSchool(
    String tenantId,
    String token,
  ) async {
    final response = await _auth.apiV1AuthSelectSchoolPost(
      selectSchoolInput: SelectSchoolInput(tenantId: tenantId),
      headers: {'Authorization': 'Bearer $token'},
      extra: _public,
    );
    return _body<SelectSchoolTokens>(response);
  }

  Future<void> _begin({
    required String accessToken,
    required String refreshToken,
  }) async {
    _epoch++;
    _selectToken = null;
    await _store.write(SecureKey.refreshToken, refreshToken);
    _accessToken = accessToken;
    state = const SignedIn();
  }

  /// Signs out on this device and wipes it (spec 09 Cache security).
  Future<void> _end() async {
    _epoch++;
    _accessToken = null;
    _selectToken = null;
    try {
      await _store.wipe();
      await ref.read(cacheWipeProvider)();
    } finally {
      ref.read(lockControllerProvider.notifier).reset();
      state = const SignedOut();
    }
  }

  /// Runs [body] after every earlier refresh or switch has finished.
  Future<T> _exclusive<T>(Future<T> Function() body) {
    final run = _tail.then((_) => body());
    _tail = run.then<void>((_) {}, onError: (Object _) {});
    return run;
  }

  static T _body<T>(Response<T> response) {
    final data = response.data;
    if (data == null) throw StateError('The API answered with no body.');
    return data;
  }

  static String _present(String? token) {
    if (token == null) throw StateError('The API answered with no token.');
    return token;
  }
}
