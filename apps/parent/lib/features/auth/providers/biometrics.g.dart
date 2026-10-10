// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'biometrics.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The device's enrolled biometric, or null when there is none (the offer is
/// skipped and the lock says "Unlock", with the passcode).

@ProviderFor(biometricKind)
final biometricKindProvider = BiometricKindProvider._();

/// The device's enrolled biometric, or null when there is none (the offer is
/// skipped and the lock says "Unlock", with the passcode).

final class BiometricKindProvider
    extends
        $FunctionalProvider<
          AsyncValue<BiometricKind?>,
          BiometricKind?,
          FutureOr<BiometricKind?>
        >
    with $FutureModifier<BiometricKind?>, $FutureProvider<BiometricKind?> {
  /// The device's enrolled biometric, or null when there is none (the offer is
  /// skipped and the lock says "Unlock", with the passcode).
  BiometricKindProvider._()
    : super(
        from: null,
        argument: null,
        retry: noRetry,
        name: r'biometricKindProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$biometricKindHash();

  @$internal
  @override
  $FutureProviderElement<BiometricKind?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<BiometricKind?> create(Ref ref) {
    return biometricKind(ref);
  }
}

String _$biometricKindHash() => r'111894bb892cfc4251d008f682058d6aa850aeb3';
