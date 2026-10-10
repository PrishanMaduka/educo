import 'package:dio/dio.dart';

/// What went wrong with an API call, by the stable error `code` the API
/// sends (spec 06), so screens pick their own copy from the ARB.
enum ApiProblem {
  /// No answer: offline, a timeout, or the API is down.
  offline,

  /// 400 `validation`: a field the API refused.
  validation,

  /// 400 `invalid_code`: a wrong, expired or used-up code.
  invalidCode,

  /// 429 `rate_limited`.
  rateLimited,

  /// 403 `account_locked`.
  locked,

  /// 403 `school_suspended`: the school is paused on Quad (spec 07).
  schoolSuspended,

  /// 401: the token was refused.
  unauthorized,

  /// Anything else.
  other,
}

/// The [ApiProblem] behind [error].
ApiProblem apiProblemOf(Object error) {
  if (error is! DioException) return ApiProblem.other;
  final response = error.response;
  if (response == null) return ApiProblem.offline;
  if (response.statusCode == 401) return ApiProblem.unauthorized;
  return switch (_codeOf(response.data)) {
    'validation' => ApiProblem.validation,
    'invalid_code' => ApiProblem.invalidCode,
    'rate_limited' => ApiProblem.rateLimited,
    'account_locked' => ApiProblem.locked,
    'school_suspended' => ApiProblem.schoolSuspended,
    _ => response.statusCode == 429 ? ApiProblem.rateLimited : ApiProblem.other,
  };
}

String? _codeOf(Object? data) {
  if (data is! Map) return null;
  final code = data['code'];
  return code is String ? code : null;
}
