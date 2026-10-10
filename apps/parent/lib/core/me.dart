import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'me.g.dart';

/// Thrown by [currentMeProvider] when no school is signed in.
class NotSignedIn implements Exception {
  const new();
}

/// No automatic retry: the screens offer **Try again** instead.
Duration? noRetry(int retryCount, Object error) => null;

/// `GET /me` for one school session: the parent's name, the school with the
/// brand the API computed, and the other schools to switch to.
///
/// Keyed to the [SignedIn] value, so a sign-in or a school switch starts a
/// new entry with no previous value: nothing of the previous school shows
/// while the new one loads (spec 09 Cache security). An entry nobody watches
/// is dropped.
@Riverpod(retry: noRetry)
Future<Me> me(Ref ref, SignedIn session) async {
  final response = await ref.read(quadApiProvider).getMeApi().apiV1MeGet();
  final me = response.data;
  if (me == null) throw StateError('The API answered with no body.');
  return me;
}

/// `GET /me` for the school signed in now; an error when signed out.
@riverpod
AsyncValue<Me> currentMe(Ref ref) {
  final auth = ref.watch(authControllerProvider);
  if (auth is! SignedIn) {
    return AsyncError(const NotSignedIn(), StackTrace.current);
  }
  final me = ref.watch(meProvider(auth));
  // Only an answer for this school counts; another school's is an error
  // (Try again), never shown.
  final tenantId = auth.tenantId;
  return switch (me) {
    AsyncData(:final value)
        when tenantId != null && value.school.id != tenantId =>
      AsyncError(
        StateError('GET /me answered for another school.'),
        StackTrace.current,
      ),
    _ => me,
  };
}

/// Loads `GET /me` again for the school signed in now (**Try again**).
void reloadCurrentMe(WidgetRef ref) {
  final auth = ref.read(authControllerProvider);
  if (auth is SignedIn) ref.invalidate(meProvider(auth));
}

/// The school's brand once its `GET /me` has answered, or null for Quad's
/// own (D13: the welcome and sign-in steps are Quad-branded; a switch shows
/// Quad's until the new school answers).
@riverpod
MeBrand? schoolBrand(Ref ref) => switch (ref.watch(currentMeProvider)) {
  AsyncData(:final value) => value.school.brand,
  _ => null,
};
