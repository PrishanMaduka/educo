import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:quad_parent/core/clock.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'lock_controller.g.dart';

/// Whether Face ID or fingerprint unlock is on, and whether the lock screen
/// is up now.
@immutable
class LockState {
  const new({required this.biometricsOn, required this.locked});

  static const off = LockState(biometricsOn: false, locked: false);

  final bool biometricsOn;
  final bool locked;

  @override
  bool operator ==(Object other) =>
      other is LockState &&
      other.biometricsOn == biometricsOn &&
      other.locked == locked;

  @override
  int get hashCode => Object.hash(biometricsOn, locked);
}

/// The device's biometric prompt; tests override it with a fake.
@Riverpod(keepAlive: true)
LocalAuthentication localAuth(Ref ref) => LocalAuthentication();

/// The lock screen (spec 09 Re-lock): with biometrics on, the app locks at
/// launch and when it comes back after more than [relockAfter] in the
/// background, measured from `AppLifecycleState.paused`.
@Riverpod(keepAlive: true)
class LockController extends _$LockController {
  static const relockAfter = Duration(minutes: 5);

  DateTime? _pausedAt;

  @override
  LockState build() => LockState.off;

  /// Reads the setting at launch; the auth controller calls this before it
  /// reports a restored session, so no tab shows before the lock.
  Future<void> restoreAtLaunch() async {
    final on = await ref.read(secureStoreProvider).read(SecureKey.biometricsOn);
    final isOn = on == 'true';
    state = LockState(biometricsOn: isOn, locked: isOn);
  }

  /// The app went to the background. A second pause keeps the first time.
  void paused() => _pausedAt ??= ref.read(clockProvider)();

  /// The app is back in front.
  void resumed() {
    final pausedAt = _pausedAt;
    _pausedAt = null;
    if (pausedAt == null || !state.biometricsOn) return;
    if (ref.read(clockProvider)().difference(pausedAt) > relockAfter) {
      state = LockState(biometricsOn: state.biometricsOn, locked: true);
    }
  }

  /// Shows the system prompt with [reason] (from the ARB); the device
  /// passcode is the fallback ("Use passcode", spec 05 step 6).
  Future<bool> unlock({required String reason}) async {
    final bool ok;
    try {
      ok = await ref
          .read(localAuthProvider)
          .authenticate(
            localizedReason: reason,
            persistAcrossBackgrounding: true,
          );
    } on LocalAuthException {
      // Cancelled, no passcode set, or the prompt could not show: the lock
      // screen stays, with its button to try again.
      return false;
    }
    if (ok) state = LockState(biometricsOn: state.biometricsOn, locked: false);
    return ok;
  }

  /// The parent's choice on "Unlock with Face ID?" or in Profile. It takes
  /// effect from the next launch or return from the background.
  Future<void> setBiometricsOn({required bool on}) async {
    final store = ref.read(secureStoreProvider);
    if (on) {
      await store.write(SecureKey.biometricsOn, 'true');
    } else {
      await store.delete(SecureKey.biometricsOn);
    }
    state = LockState(biometricsOn: on, locked: state.locked && on);
  }

  /// Signed out: the setting went with the wiped secure store.
  void reset() {
    _pausedAt = null;
    state = LockState.off;
  }
}
