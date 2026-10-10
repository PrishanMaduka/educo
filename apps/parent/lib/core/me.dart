import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'me.g.dart';

/// Thrown by [meProvider] when no school is signed in.
class NotSignedIn implements Exception {
  const new();
}

/// No automatic retry: the screens offer **Try again** instead.
Duration? noRetry(int retryCount, Object error) => null;

/// `GET /me` for the signed-in school: the parent's name, the school with
/// the brand the API computed, and the other schools to switch to.
///
/// It reloads when a session starts or ends; a school switch invalidates it
/// (see `switchToSchool`).
@Riverpod(keepAlive: true, retry: noRetry)
Future<Me> me(Ref ref) async {
  final signedIn = ref.watch(
    authControllerProvider.select((state) => state is SignedIn),
  );
  if (!signedIn) throw const NotSignedIn();
  final response = await ref.read(quadApiProvider).getMeApi().apiV1MeGet();
  final me = response.data;
  if (me == null) throw StateError('The API answered with no body.');
  return me;
}

/// The school's brand while signed in, or null for Quad's own (D13: the
/// welcome and sign-in steps are Quad-branded).
@riverpod
MeSchoolBrand? schoolBrand(Ref ref) {
  final signedIn = ref.watch(
    authControllerProvider.select((state) => state is SignedIn),
  );
  if (!signedIn) return null;
  return ref.watch(meProvider).value?.school.brand;
}
