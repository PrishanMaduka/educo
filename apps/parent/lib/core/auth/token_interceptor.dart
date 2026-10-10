import 'package:dio/dio.dart';

/// Where [TokenInterceptor] gets the access token and asks for a new one.
abstract interface class AccessTokens {
  /// The access token in memory, if any (it is never stored).
  String? get accessToken;

  /// Whether a refresh token is on the device to get a new access token.
  bool get canRefresh;

  /// A fresh access token after [rejected] was refused (or there was none),
  /// or null when there is none to be had. Concurrent callers share one
  /// refresh (single flight, D32).
  Future<String?> refreshAfter(String? rejected);
}

/// Adds `Authorization: Bearer` to the generated client's requests and, on a
/// 401, refreshes once and retries the request once with the new token.
class TokenInterceptor extends Interceptor {
  new({required this._dio, required this._tokens});

  /// Set in a request's `extra` to send it without the parent's token: the
  /// sign-in routes, and calls that carry their own token.
  static const skipAuth = 'quad.skipAuth';

  static const _sentWith = 'quad.sentWith';
  static const _retried = 'quad.retried';
  static const _header = 'Authorization';

  final Dio _dio;
  final AccessTokens Function() _tokens;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[skipAuth] == true ||
        options.headers.containsKey(_header)) {
      return handler.next(options);
    }
    final tokens = _tokens();
    // At launch only the refresh token is on the device: get an access token
    // first rather than spend a request on a certain 401.
    final token =
        tokens.accessToken ??
        (tokens.canRefresh ? await tokens.refreshAfter(null) : null);
    if (token != null) {
      options.headers[_header] = 'Bearer $token';
      options.extra[_sentWith] = token;
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final sentWith = request.extra[_sentWith];
    if (err.response?.statusCode != 401 ||
        sentWith is! String ||
        request.extra[_retried] == true) {
      return handler.next(err);
    }
    final fresh = await _tokens().refreshAfter(sentWith);
    if (fresh == null) return handler.next(err);
    final retry = request.copyWith(
      headers: {...request.headers, _header: 'Bearer $fresh'},
      extra: {...request.extra, _sentWith: fresh, _retried: true},
    );
    try {
      handler.resolve(await _dio.fetch<Object?>(retry));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }
}
