// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'install_marker.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(installMarker)
final installMarkerProvider = InstallMarkerProvider._();

final class InstallMarkerProvider
    extends $FunctionalProvider<InstallMarker, InstallMarker, InstallMarker>
    with $Provider<InstallMarker> {
  InstallMarkerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'installMarkerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$installMarkerHash();

  @$internal
  @override
  $ProviderElement<InstallMarker> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  InstallMarker create(Ref ref) {
    return installMarker(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(InstallMarker value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<InstallMarker>(value),
    );
  }
}

String _$installMarkerHash() => r'01c78d655684e723e970f169a5681b25f3815150';
