import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'install_marker.g.dart';

/// Tells a fresh install from a later launch. The iOS Keychain outlives an
/// uninstall but app preferences do not, so a missing marker means the secure
/// store may hold a previous install's session (spec 09 Cache security).
abstract interface class InstallMarker {
  Future<bool> isFreshInstall();

  Future<void> markInstalled();
}

/// [InstallMarker] in `shared_preferences` (D32).
class PrefsInstallMarker implements InstallMarker {
  const new();

  static const _key = 'quad.installed';

  @override
  Future<bool> isFreshInstall() async =>
      await SharedPreferencesAsync().getBool(_key) != true;

  @override
  Future<void> markInstalled() => SharedPreferencesAsync().setBool(_key, true);
}

@Riverpod(keepAlive: true)
InstallMarker installMarker(Ref ref) => const PrefsInstallMarker();
