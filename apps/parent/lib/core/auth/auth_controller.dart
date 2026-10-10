import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:quad_parent/core/auth/token_interceptor.dart';
import 'package:quad_parent/core/cache_wipe.dart';
import 'package:quad_parent/core/install_marker.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_controller.g.dart';

/// The parent's session (spec 05 Parent app, spec 09 Cache security).
///
/// The refresh token lives in [SecureStore]; the access token only in memory.
/// Refreshes are single flight, and a refresh and a school switch never
/// overlap: the API has no grace window, so presenting a rotated-out refresh
/// token even once revokes the whole family (D32). Sign-out and a new
/// session's first write join the same queue, so nothing lands after a wipe.
/// A refused refresh (401: reuse, revocation, or a family past its 60 days)
/// signs out and wipes the device.
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

  /// Counts sign-ins and switches for [SignedIn.school].
  int _school = 0;
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
          tenantId: result.memberships.length == 1
              ? result.memberships.single.tenantId
              : null,
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
      tenantId: tenantId,
    );
  }

  /// Switch school: the family moves to [tenantId] and gets a new access
  /// token; the refresh token stays. The previous school's cache is wiped
  /// before the new token is used (spec 09).
  Future<void> switchSchool(String tenantId) => _exclusive(() async {
    final epoch = _epoch;
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
    final stillHere = refreshToken == null
        ? epoch == _epoch
        : await _storeRefreshToken(refreshToken, epoch);
    if (!stillHere) throw StateError('The session ended during the switch.');
    await ref.read(cacheWipeProvider)();
    if (epoch != _epoch) {
      throw StateError('The session ended during the switch.');
    }
    _accessToken = tokens.accessToken;
    // A new school: what was loaded for the previous one is not reused.
    state = SignedIn(tenantId: tenantId, school: ++_school);
  });

  /// Revokes this device's family (and, from M6, its push token), then wipes
  /// the device (spec 05 step 7).
  ///
  /// It waits for a refresh or switch in flight, so it revokes with the token
  /// that came out of it and no write lands after the wipe.
  Future<void> signOut() => _exclusive(() async {
    final token = state is SignedIn
        ? _accessToken ?? await _refresh(null)
        : null;
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
  });

  AuthApi get _auth => ref.read(quadApiProvider).getAuthApi();

  SecureStore get _store => ref.read(secureStoreProvider);

  Future<void> _restore() async {
    final marker = ref.read(installMarkerProvider);
    if (await marker.isFreshInstall()) {
      // The iOS Keychain outlives an uninstall: a previous install's session
      // must not come back (spec 09 Cache security).
      await _store.wipe();
      await marker.markInstalled();
    }
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
    if (epoch != _epoch) return null;
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
      // Only 401 means the family is gone (reused, revoked or expired).
      // Anything else (offline, 400, 429, 5xx) keeps the session; the
      // request fails and a later one tries again.
      if (error.response?.statusCode == 401 && epoch == _epoch) await _end();
      return null;
    }
    // Stored before it is used, so a crash never leaves the old one behind.
    if (!await _storeRefreshToken(pair.refreshToken, epoch)) return null;
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
    String? tenantId,
  }) => _exclusive(() async {
    final epoch = ++_epoch;
    _selectToken = null;
    if (!await _storeRefreshToken(refreshToken, epoch)) return;
    _accessToken = accessToken;
    state = SignedIn(tenantId: tenantId, school: ++_school);
  });

  /// Writes [refreshToken] for the session [epoch]. False, with nothing left
  /// in the store, when that session ended before or during the write.
  Future<bool> _storeRefreshToken(String refreshToken, int epoch) async {
    if (epoch != _epoch) return false;
    await _store.write(SecureKey.refreshToken, refreshToken);
    if (epoch == _epoch) return true;
    // A wipe ran while the write was on its way: take it back out.
    await _store.delete(SecureKey.refreshToken);
    return false;
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

  /// Runs [body] after every earlier refresh, switch, sign-in write or
  /// sign-out has finished. Bodies call [_refresh] directly, never
  /// [refreshAfter], which would wait on this queue.
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
