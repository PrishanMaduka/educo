import 'package:test/test.dart';
import 'package:quad_api/quad_api.dart';


/// tests for HealthApi
void main() {
  final instance = QuadApi().getHealthApi();

  group(HealthApi, () {
    // The process is up
    //
    //Future<HealthLive> apiV1HealthLiveGet() async
    test('test apiV1HealthLiveGet', () async {
      // TODO
    });

    // Postgres and Redis answer
    //
    //Future<HealthReady> apiV1HealthReadyGet() async
    test('test apiV1HealthReadyGet', () async {
      // TODO
    });

  });
}
