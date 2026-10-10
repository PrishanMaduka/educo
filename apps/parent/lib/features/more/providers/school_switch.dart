import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'school_switch.g.dart';

/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used, and starts a new school session, so `GET /me`
/// (the brand, the name, the schools to switch to) loads afresh with nothing
/// of the previous school in between. Once the switch succeeds, a failing
/// `GET /me` is the new school's to retry, not a failed switch.
@riverpod
class SchoolSwitch extends _$SchoolSwitch {
  @override
  FutureOr<void> build() {}

  /// Opens [tenantId], one of the parent's own memberships; the API checks it.
  Future<void> to(String tenantId) async {
    state = const AsyncLoading();
    try {
      await ref.read(authControllerProvider.notifier).switchSchool(tenantId);
      state = const AsyncData(null);
    } catch (error, stack) {
      state = AsyncError(error, stack);
      rethrow;
    }
  }
}
