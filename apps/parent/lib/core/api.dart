import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/env.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'api.g.dart';

/// The generated API client for this build's API_URL.
@Riverpod(keepAlive: true)
QuadApi quadApi(Ref ref) {
  // The generated paths already start with /api/v1, so the client gets the origin.
  return QuadApi(basePathOverride: ref.watch(envProvider).apiUrl.origin);
}
