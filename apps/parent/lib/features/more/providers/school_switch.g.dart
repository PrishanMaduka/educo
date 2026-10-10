// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'school_switch.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used; then `GET /me` is loaded afresh, so the brand,
/// name and everything else come from the new school.

@ProviderFor(SchoolSwitch)
final schoolSwitchProvider = SchoolSwitchProvider._();

/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used; then `GET /me` is loaded afresh, so the brand,
/// name and everything else come from the new school.
final class SchoolSwitchProvider
    extends $AsyncNotifierProvider<SchoolSwitch, void> {
  /// **Switch school** in More (spec 05 One parent, two schools; spec 09).
  ///
  /// The auth controller wipes the previous school's cache before the new
  /// school's token is used; then `GET /me` is loaded afresh, so the brand,
  /// name and everything else come from the new school.
  SchoolSwitchProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'schoolSwitchProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$schoolSwitchHash();

  @$internal
  @override
  SchoolSwitch create() => SchoolSwitch();
}

String _$schoolSwitchHash() => r'd67ff39be054aa8d86f70d5b5bfea5c9b301b5a4';

/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used; then `GET /me` is loaded afresh, so the brand,
/// name and everything else come from the new school.

abstract class _$SchoolSwitch extends $AsyncNotifier<void> {
  FutureOr<void> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<void>, void>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<void>, void>,
              AsyncValue<void>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
