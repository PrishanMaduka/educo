import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/me.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'biometrics.g.dart';

/// Which unlock the device offers, for the copy ("Face ID" or "fingerprint").
enum BiometricKind { face, fingerprint }

/// The device's enrolled biometric, or null when there is none (the offer is
/// skipped and the lock says "Unlock", with the passcode).
@Riverpod(retry: noRetry)
Future<BiometricKind?> biometricKind(Ref ref) async {
  final auth = ref.watch(localAuthProvider);
  try {
    if (!await auth.canCheckBiometrics) return null;
    final types = await auth.getAvailableBiometrics();
    if (types.isEmpty) return null;
    // Android reports strong or weak rather than the sensor; nearly always a
    // fingerprint.
    return types.contains(BiometricType.face)
        ? BiometricKind.face
        : BiometricKind.fingerprint;
  } on PlatformException {
    return null;
  } on LocalAuthException {
    return null;
  }
}
