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
/// school's token is used, and starts a new school session, so `GET /me`
/// (the brand, the name, the schools to switch to) loads afresh with nothing
/// of the previous school in between. Once the switch succeeds, a failing
/// `GET /me` is the new school's to retry, not a failed switch.

@ProviderFor(SchoolSwitch)
final schoolSwitchProvider = SchoolSwitchProvider._();

/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used, and starts a new school session, so `GET /me`
/// (the brand, the name, the schools to switch to) loads afresh with nothing
/// of the previous school in between. Once the switch succeeds, a failing
/// `GET /me` is the new school's to retry, not a failed switch.
final class SchoolSwitchProvider
    extends $AsyncNotifierProvider<SchoolSwitch, void> {
  /// **Switch school** in More (spec 05 One parent, two schools; spec 09).
  ///
  /// The auth controller wipes the previous school's cache before the new
  /// school's token is used, and starts a new school session, so `GET /me`
  /// (the brand, the name, the schools to switch to) loads afresh with nothing
  /// of the previous school in between. Once the switch succeeds, a failing
  /// `GET /me` is the new school's to retry, not a failed switch.
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

String _$schoolSwitchHash() => r'41c98131284d9f55f3fbe2d13fecea1014db4dac';

/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used, and starts a new school session, so `GET /me`
/// (the brand, the name, the schools to switch to) loads afresh with nothing
/// of the previous school in between. Once the switch succeeds, a failing
/// `GET /me` is the new school's to retry, not a failed switch.

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
