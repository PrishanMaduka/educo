import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/core/api_problem.dart';

DioException _answer(int status, String code) {
  final options = RequestOptions(path: '/api/v1/auth/select-school');
  return DioException(
    requestOptions: options,
    response: Response(
      requestOptions: options,
      statusCode: status,
      data: {'code': code, 'message': 'Paused'},
    ),
  );
}

void main() {
  test('403 school_suspended is a paused school', () {
    expect(
      apiProblemOf(_answer(403, 'school_suspended')),
      ApiProblem.schoolSuspended,
    );
  });

  test('another 403 stays other', () {
    expect(apiProblemOf(_answer(403, 'forbidden')), ApiProblem.other);
  });
}
