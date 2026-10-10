// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cache_wipe.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(cacheWipe)
final cacheWipeProvider = CacheWipeProvider._();

final class CacheWipeProvider
    extends $FunctionalProvider<CacheWipe, CacheWipe, CacheWipe>
    with $Provider<CacheWipe> {
  CacheWipeProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'cacheWipeProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$cacheWipeHash();

  @$internal
  @override
  $ProviderElement<CacheWipe> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  CacheWipe create(Ref ref) {
    return cacheWipe(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(CacheWipe value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<CacheWipe>(value),
    );
  }
}

String _$cacheWipeHash() => r'014cf07436a02397ec5236fbca411e8287609bf3';
