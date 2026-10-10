import 'package:dio/dio.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/token_interceptor.dart';
import 'package:quad_parent/core/env.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'api.g.dart';

/// The generated API client for this build's API_URL, with the parent's
/// bearer token and refresh-on-401 ([TokenInterceptor]).
@Riverpod(keepAlive: true)
QuadApi quadApi(Ref ref) {
  // The generated paths already start with /api/v1, so the client gets the
  // origin. Timeouts as the generated client's defaults.
  final dio = Dio(
    BaseOptions(
      baseUrl: ref.watch(envProvider).apiUrl.origin,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 3),
    ),
  );
  dio.interceptors.add(
    // Read when a request runs, not now: the auth controller calls this
    // client, so watching it here would be a cycle.
    TokenInterceptor(
      dio: dio,
      tokens: () => ref.read(authControllerProvider.notifier),
    ),
  );
  // An empty list keeps the generated auth interceptors out: the parent app
  // has one token, and TokenInterceptor sends it.
  return QuadApi(dio: dio, interceptors: const []);
}
