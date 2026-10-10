// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lock_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The device's biometric prompt; tests override it with a fake.

@ProviderFor(localAuth)
final localAuthProvider = LocalAuthProvider._();

/// The device's biometric prompt; tests override it with a fake.

final class LocalAuthProvider
    extends
        $FunctionalProvider<
          LocalAuthentication,
          LocalAuthentication,
          LocalAuthentication
        >
    with $Provider<LocalAuthentication> {
  /// The device's biometric prompt; tests override it with a fake.
  LocalAuthProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localAuthProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localAuthHash();

  @$internal
  @override
  $ProviderElement<LocalAuthentication> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  LocalAuthentication create(Ref ref) {
    return localAuth(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(LocalAuthentication value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<LocalAuthentication>(value),
    );
  }
}

String _$localAuthHash() => r'5628479258eabd9693eb6df68447df86aff385a3';

/// The lock screen (spec 09 Re-lock): with biometrics on, the app locks at
/// launch and when it comes back after more than [relockAfter] in the
/// background, measured from `AppLifecycleState.paused`.

@ProviderFor(LockController)
final lockControllerProvider = LockControllerProvider._();

/// The lock screen (spec 09 Re-lock): with biometrics on, the app locks at
/// launch and when it comes back after more than [relockAfter] in the
/// background, measured from `AppLifecycleState.paused`.
final class LockControllerProvider
    extends $NotifierProvider<LockController, LockState> {
  /// The lock screen (spec 09 Re-lock): with biometrics on, the app locks at
  /// launch and when it comes back after more than [relockAfter] in the
  /// background, measured from `AppLifecycleState.paused`.
  LockControllerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'lockControllerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$lockControllerHash();

  @$internal
  @override
  LockController create() => LockController();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(LockState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<LockState>(value),
    );
  }
}

String _$lockControllerHash() => r'e5b8ecdb7dd53ecca796b0ac37a2ed403d6de45e';

/// The lock screen (spec 09 Re-lock): with biometrics on, the app locks at
/// launch and when it comes back after more than [relockAfter] in the
/// background, measured from `AppLifecycleState.paused`.

abstract class _$LockController extends $Notifier<LockState> {
  LockState build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<LockState, LockState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<LockState, LockState>,
              LockState,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
