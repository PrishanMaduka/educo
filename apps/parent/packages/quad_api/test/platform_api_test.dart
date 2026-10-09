import 'package:test/test.dart';
import 'package:quad_api/quad_api.dart';


/// tests for PlatformApi
void main() {
  final instance = QuadApi().getPlatformApi();

  group(PlatformApi, () {
    // Console: sign in with email and password; sets the console cookies and asks for the authenticator code (or to set one up)
    //
    //Future<PlatformSignInResult> apiV1PlatformAuthPasswordPost(PlatformPasswordSignInInput platformPasswordSignInInput) async
    test('test apiV1PlatformAuthPasswordPost', () async {
      // TODO
    });

    // Console: sign out this browser and clear the console cookies (needs X-CSRF-Token)
    //
    //Future apiV1PlatformAuthSignOutPost() async
    test('test apiV1PlatformAuthSignOutPost', () async {
      // TODO
    });

    // Console, first sign-in: a new authenticator secret and its otpauth URI, shown once (needs X-CSRF-Token)
    //
    //Future<PlatformTotpSetup> apiV1PlatformAuthTotpSetupPost() async
    test('test apiV1PlatformAuthTotpSetupPost', () async {
      // TODO
    });

    // Console: check the authenticator code (or the first code of a new one) and open the console on a new cookie (needs X-CSRF-Token)
    //
    //Future<PlatformSignInResult> apiV1PlatformAuthTotpVerifyPost(PlatformTotpVerifyInput platformTotpVerifyInput) async
    test('test apiV1PlatformAuthTotpVerifyPost', () async {
      // TODO
    });

    // Console: the signed-in Quad staff member’s name and role
    //
    //Future<PlatformMe> apiV1PlatformMeGet() async
    test('test apiV1PlatformMeGet', () async {
      // TODO
    });

  });
}
