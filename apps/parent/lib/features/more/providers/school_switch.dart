import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/me.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'school_switch.g.dart';

/// **Switch school** in More (spec 05 One parent, two schools; spec 09).
///
/// The auth controller wipes the previous school's cache before the new
/// school's token is used; then `GET /me` is loaded afresh, so the brand,
/// name and everything else come from the new school.
@riverpod
class SchoolSwitch extends _$SchoolSwitch {
  @override
  FutureOr<void> build() {}

  /// Opens [tenantId], one of the parent's own memberships; the API checks it.
  Future<Me> to(String tenantId) async {
    state = const AsyncLoading();
    try {
      await ref.read(authControllerProvider.notifier).switchSchool(tenantId);
      ref.invalidate(meProvider);
      final me = await ref.read(meProvider.future);
      state = const AsyncData(null);
      return me;
    } catch (error, stack) {
      state = AsyncError(error, stack);
      rethrow;
    }
  }
}
