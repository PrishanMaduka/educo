// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// `GET /me` for the signed-in school: the parent's name, the school with
/// the brand the API computed, and the other schools to switch to.
///
/// It reloads when a session starts or ends; a school switch invalidates it
/// (see `switchToSchool`).

@ProviderFor(me)
final meProvider = MeProvider._();

/// `GET /me` for the signed-in school: the parent's name, the school with
/// the brand the API computed, and the other schools to switch to.
///
/// It reloads when a session starts or ends; a school switch invalidates it
/// (see `switchToSchool`).

final class MeProvider
    extends $FunctionalProvider<AsyncValue<Me>, Me, FutureOr<Me>>
    with $FutureModifier<Me>, $FutureProvider<Me> {
  /// `GET /me` for the signed-in school: the parent's name, the school with
  /// the brand the API computed, and the other schools to switch to.
  ///
  /// It reloads when a session starts or ends; a school switch invalidates it
  /// (see `switchToSchool`).
  MeProvider._()
    : super(
        from: null,
        argument: null,
        retry: noRetry,
        name: r'meProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$meHash();

  @$internal
  @override
  $FutureProviderElement<Me> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<Me> create(Ref ref) {
    return me(ref);
  }
}

String _$meHash() => r'258be96d2b15579aa2f654e562d30ed44fdcc3ff';

/// The school's brand while signed in, or null for Quad's own (D13: the
/// welcome and sign-in steps are Quad-branded).

@ProviderFor(schoolBrand)
final schoolBrandProvider = SchoolBrandProvider._();

/// The school's brand while signed in, or null for Quad's own (D13: the
/// welcome and sign-in steps are Quad-branded).

final class SchoolBrandProvider
    extends $FunctionalProvider<MeSchoolBrand?, MeSchoolBrand?, MeSchoolBrand?>
    with $Provider<MeSchoolBrand?> {
  /// The school's brand while signed in, or null for Quad's own (D13: the
  /// welcome and sign-in steps are Quad-branded).
  SchoolBrandProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'schoolBrandProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$schoolBrandHash();

  @$internal
  @override
  $ProviderElement<MeSchoolBrand?> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  MeSchoolBrand? create(Ref ref) {
    return schoolBrand(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(MeSchoolBrand? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<MeSchoolBrand?>(value),
    );
  }
}

String _$schoolBrandHash() => r'f753a2daec140f7819fe32f5bed340e78d52502d';
