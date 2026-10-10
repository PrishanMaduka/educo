import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'secure_store.g.dart';

/// What the app keeps in the Keychain or the Android Keystore (spec 09 Cache
/// security). The access token is never here: it lives only in memory.
enum SecureKey {
  /// The parent token family's rotating refresh token (spec 05 step 5).
  refreshToken('quad.refresh_token'),

  /// `true` once the parent turned on Face ID or fingerprint unlock.
  biometricsOn('quad.biometrics_on');

  new(this.storageKey);

  final String storageKey;
}

/// The device's secure storage, behind an interface so tests use memory.
abstract interface class SecureStore {
  Future<String?> read(SecureKey key);

  Future<void> write(SecureKey key, String value);

  Future<void> delete(SecureKey key);

  /// Removes every value this app stored (sign-out, a revoked family).
  Future<void> wipe();
}

/// [SecureStore] on `flutter_secure_storage` (D32: pinned plugin versions).
class DeviceSecureStore implements SecureStore {
  const new([
    this._storage = const FlutterSecureStorage(
      // Readable after the first unlock, so a refresh can run before the
      // parent opens the app; never synced to iCloud or restored on another
      // device.
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  ]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(SecureKey key) => _storage.read(key: key.storageKey);

  @override
  Future<void> write(SecureKey key, String value) =>
      _storage.write(key: key.storageKey, value: value);

  @override
  Future<void> delete(SecureKey key) => _storage.delete(key: key.storageKey);

  @override
  Future<void> wipe() => _storage.deleteAll();
}

@Riverpod(keepAlive: true)
SecureStore secureStore(Ref ref) => const DeviceSecureStore();
