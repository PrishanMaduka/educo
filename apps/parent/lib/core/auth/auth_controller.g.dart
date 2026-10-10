// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The parent's session (spec 05 Parent app, spec 09 Cache security).
///
/// The refresh token lives in [SecureStore]; the access token only in memory.
/// Refreshes are single flight, and a refresh and a school switch never
/// overlap: the API has no grace window, so presenting a rotated-out refresh
/// token even once revokes the whole family (D32). Sign-out and a new
/// session's first write join the same queue, so nothing lands after a wipe.
/// A refused refresh (401: reuse, revocation, or a family past its 60 days)
/// signs out and wipes the device.

@ProviderFor(AuthController)
final authControllerProvider = AuthControllerProvider._();

/// The parent's session (spec 05 Parent app, spec 09 Cache security).
///
/// The refresh token lives in [SecureStore]; the access token only in memory.
/// Refreshes are single flight, and a refresh and a school switch never
/// overlap: the API has no grace window, so presenting a rotated-out refresh
/// token even once revokes the whole family (D32). Sign-out and a new
/// session's first write join the same queue, so nothing lands after a wipe.
/// A refused refresh (401: reuse, revocation, or a family past its 60 days)
/// signs out and wipes the device.
final class AuthControllerProvider
    extends $NotifierProvider<AuthController, AuthState> {
  /// The parent's session (spec 05 Parent app, spec 09 Cache security).
  ///
  /// The refresh token lives in [SecureStore]; the access token only in memory.
  /// Refreshes are single flight, and a refresh and a school switch never
  /// overlap: the API has no grace window, so presenting a rotated-out refresh
  /// token even once revokes the whole family (D32). Sign-out and a new
  /// session's first write join the same queue, so nothing lands after a wipe.
  /// A refused refresh (401: reuse, revocation, or a family past its 60 days)
  /// signs out and wipes the device.
  AuthControllerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'authControllerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$authControllerHash();

  @$internal
  @override
  AuthController create() => AuthController();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AuthState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AuthState>(value),
    );
  }
}

String _$authControllerHash() => r'6494c9d95ecdabb9b607b487fc2f3446b283600e';

/// The parent's session (spec 05 Parent app, spec 09 Cache security).
///
/// The refresh token lives in [SecureStore]; the access token only in memory.
/// Refreshes are single flight, and a refresh and a school switch never
/// overlap: the API has no grace window, so presenting a rotated-out refresh
/// token even once revokes the whole family (D32). Sign-out and a new
/// session's first write join the same queue, so nothing lands after a wipe.
/// A refused refresh (401: reuse, revocation, or a family past its 60 days)
/// signs out and wipes the device.

abstract class _$AuthController extends $Notifier<AuthState> {
  AuthState build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AuthState, AuthState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AuthState, AuthState>,
              AuthState,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
