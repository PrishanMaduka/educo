import 'package:dio/dio.dart';

/// What went wrong with an API call, by the stable error `code` the API
/// sends (spec 06), so screens pick their own copy from the ARB.
enum ApiProblem {
  /// No answer: offline, a timeout, or the API is down.
  offline,

  /// 400 `validation`: see [apiFieldOf] for the field.
  validation,

  /// 400 `invalid_code`: a wrong, expired or used-up code.
  invalidCode,

  /// 429 `rate_limited`.
  rateLimited,

  /// 403 `account_locked`.
  locked,

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
    _ => response.statusCode == 429 ? ApiProblem.rateLimited : ApiProblem.other,
  };
}

/// The first field a 400 `validation` names (`phone`, `email`, `code`).
String? apiFieldOf(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is! Map) return null;
  final fields = data['fields'];
  if (fields is! Map || fields.isEmpty) return null;
  return fields.keys.first.toString();
}

String? _codeOf(Object? data) {
  if (data is! Map) return null;
  final code = data['code'];
  return code is String ? code : null;
}
