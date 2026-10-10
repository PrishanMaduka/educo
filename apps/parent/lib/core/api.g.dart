// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The generated API client for this build's API_URL, with the parent's
/// bearer token and refresh-on-401 ([TokenInterceptor]).

@ProviderFor(quadApi)
final quadApiProvider = QuadApiProvider._();

/// The generated API client for this build's API_URL, with the parent's
/// bearer token and refresh-on-401 ([TokenInterceptor]).

final class QuadApiProvider
    extends $FunctionalProvider<QuadApi, QuadApi, QuadApi>
    with $Provider<QuadApi> {
  /// The generated API client for this build's API_URL, with the parent's
  /// bearer token and refresh-on-401 ([TokenInterceptor]).
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

String _$quadApiHash() => r'd19a19a54ccc467a8d5012dd7f4a6b360b854646';
