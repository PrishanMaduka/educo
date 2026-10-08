// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The generated API client for this build's API_URL.

@ProviderFor(quadApi)
final quadApiProvider = QuadApiProvider._();

/// The generated API client for this build's API_URL.

final class QuadApiProvider
    extends $FunctionalProvider<QuadApi, QuadApi, QuadApi>
    with $Provider<QuadApi> {
  /// The generated API client for this build's API_URL.
  QuadApiProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'quadApiProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$quadApiHash();

  @$internal
  @override
  $ProviderElement<QuadApi> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  QuadApi create(Ref ref) {
    return quadApi(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(QuadApi value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<QuadApi>(value),
    );
  }
}

String _$quadApiHash() => r'00c3238936d107524e1950d2eca7f524bf44a24a';
