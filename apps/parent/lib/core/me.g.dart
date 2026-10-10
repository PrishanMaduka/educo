// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// `GET /me` for one school session: the parent's name, the school with the
/// brand the API computed, and the other schools to switch to.
///
/// Keyed to the [SignedIn] value, so a sign-in or a school switch starts a
/// new entry with no previous value: nothing of the previous school shows
/// while the new one loads (spec 09 Cache security). An entry nobody watches
/// is dropped.

@ProviderFor(me)
final meProvider = MeFamily._();

/// `GET /me` for one school session: the parent's name, the school with the
/// brand the API computed, and the other schools to switch to.
///
/// Keyed to the [SignedIn] value, so a sign-in or a school switch starts a
/// new entry with no previous value: nothing of the previous school shows
/// while the new one loads (spec 09 Cache security). An entry nobody watches
/// is dropped.

final class MeProvider
    extends $FunctionalProvider<AsyncValue<Me>, Me, FutureOr<Me>>
    with $FutureModifier<Me>, $FutureProvider<Me> {
  /// `GET /me` for one school session: the parent's name, the school with the
  /// brand the API computed, and the other schools to switch to.
  ///
  /// Keyed to the [SignedIn] value, so a sign-in or a school switch starts a
  /// new entry with no previous value: nothing of the previous school shows
  /// while the new one loads (spec 09 Cache security). An entry nobody watches
  /// is dropped.
  MeProvider._({required MeFamily super.from, required SignedIn super.argument})
    : super(
        retry: noRetry,
        name: r'meProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$meHash();

  @override
  String toString() {
    return r'meProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<Me> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<Me> create(Ref ref) {
    final argument = this.argument as SignedIn;
    return me(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is MeProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$meHash() => r'9216c0a1e9a9b507ce99773da9233567ad5b6ae4';

/// `GET /me` for one school session: the parent's name, the school with the
/// brand the API computed, and the other schools to switch to.
///
/// Keyed to the [SignedIn] value, so a sign-in or a school switch starts a
/// new entry with no previous value: nothing of the previous school shows
/// while the new one loads (spec 09 Cache security). An entry nobody watches
/// is dropped.

final class MeFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<Me>, SignedIn> {
  MeFamily._()
    : super(
        retry: noRetry,
        name: r'meProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// `GET /me` for one school session: the parent's name, the school with the
  /// brand the API computed, and the other schools to switch to.
  ///
  /// Keyed to the [SignedIn] value, so a sign-in or a school switch starts a
  /// new entry with no previous value: nothing of the previous school shows
  /// while the new one loads (spec 09 Cache security). An entry nobody watches
  /// is dropped.

  MeProvider call(SignedIn session) =>
      MeProvider._(argument: session, from: this);

  @override
  String toString() => r'meProvider';
}

/// `GET /me` for the school signed in now; an error when signed out.

@ProviderFor(currentMe)
final currentMeProvider = CurrentMeProvider._();

/// `GET /me` for the school signed in now; an error when signed out.

final class CurrentMeProvider
    extends $FunctionalProvider<AsyncValue<Me>, AsyncValue<Me>, AsyncValue<Me>>
    with $Provider<AsyncValue<Me>> {
  /// `GET /me` for the school signed in now; an error when signed out.
  CurrentMeProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'currentMeProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$currentMeHash();

  @$internal
  @override
  $ProviderElement<AsyncValue<Me>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  AsyncValue<Me> create(Ref ref) {
    return currentMe(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AsyncValue<Me> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AsyncValue<Me>>(value),
    );
  }
}

String _$currentMeHash() => r'2e7e4410061d4e95d7599a8eeacec93da6e2dc02';

/// The school's brand once its `GET /me` has answered, or null for Quad's
/// own (D13: the welcome and sign-in steps are Quad-branded; a switch shows
/// Quad's until the new school answers).

@ProviderFor(schoolBrand)
final schoolBrandProvider = SchoolBrandProvider._();

/// The school's brand once its `GET /me` has answered, or null for Quad's
/// own (D13: the welcome and sign-in steps are Quad-branded; a switch shows
/// Quad's until the new school answers).

final class SchoolBrandProvider
    extends $FunctionalProvider<MeSchoolBrand?, MeSchoolBrand?, MeSchoolBrand?>
    with $Provider<MeSchoolBrand?> {
  /// The school's brand once its `GET /me` has answered, or null for Quad's
  /// own (D13: the welcome and sign-in steps are Quad-branded; a switch shows
  /// Quad's until the new school answers).
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

String _$schoolBrandHash() => r'8413578ecec55a47c033851a8a6e029ec7357862';
