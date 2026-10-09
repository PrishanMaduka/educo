import 'package:test/test.dart';
import 'package:quad_api/quad_api.dart';


/// tests for MeApi
void main() {
  final instance = QuadApi().getMeApi();

  group(MeApi, () {
    // The signed-in person, their school and brand, other schools, banners and greeting
    //
    //Future<Me> apiV1MeGet() async
    test('test apiV1MeGet', () async {
      // TODO
    });

    // Change your name, theme or locale in this school (needs X-CSRF-Token)
    //
    //Future<Me> apiV1MePatch(MeUpdateInput meUpdateInput) async
    test('test apiV1MePatch', () async {
      // TODO
    });

    // Your signed-in devices, newest first
    //
    //Future<SessionSummaryList> apiV1MeSessionsGet({ String cursor, int limit }) async
    test('test apiV1MeSessionsGet', () async {
      // TODO
    });

    // Sign one of your devices out (needs X-CSRF-Token)
    //
    //Future apiV1MeSessionsIdDelete(String id) async
    test('test apiV1MeSessionsIdDelete', () async {
      // TODO
    });

    // Set up an authenticator: without a code it starts one, with its code it confirms it and gives the recovery codes (needs X-CSRF-Token)
    //
    //Future<TotpSetupResult> apiV1MeTotpPost(TotpSetupInput totpSetupInput) async
    test('test apiV1MeTotpPost', () async {
      // TODO
    });

  });
}
