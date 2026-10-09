import 'package:test/test.dart';
import 'package:quad_api/quad_api.dart';


/// tests for AuthApi
void main() {
  final instance = QuadApi().getAuthApi();

  group(AuthApi, () {
    // The sign-in methods for a work email (the same answer whether or not it has an account)
    //
    //Future<IdentifyResult> apiV1AuthIdentifyPost(IdentifyInput identifyInput) async
    test('test apiV1AuthIdentifyPost', () async {
      // TODO
    });

    // The schools you can open (Choose a school, Switch school)
    //
    //Future<SignInMembershipList> apiV1AuthMembershipsGet() async
    test('test apiV1AuthMembershipsGet', () async {
      // TODO
    });

    // Email a password reset link (the same answer whether or not the account exists)
    //
    //Future apiV1AuthPasswordForgotPost(PasswordForgotInput passwordForgotInput) async
    test('test apiV1AuthPasswordForgotPost', () async {
      // TODO
    });

    // Sign in with email and password; sets the session cookies and says what comes next
    //
    //Future<SignInResult> apiV1AuthPasswordPost(PasswordSignInInput passwordSignInInput) async
    test('test apiV1AuthPasswordPost', () async {
      // TODO
    });

    // Set a new password with a reset link; signs out every device
    //
    //Future apiV1AuthPasswordResetPost(PasswordResetInput passwordResetInput) async
    test('test apiV1AuthPasswordResetPost', () async {
      // TODO
    });

    // Open one of your schools; rotates the session (needs X-CSRF-Token)
    //
    //Future apiV1AuthSelectSchoolPost(SelectSchoolInput selectSchoolInput) async
    test('test apiV1AuthSelectSchoolPost', () async {
      // TODO
    });

    // Sign out of every school on this device (needs X-CSRF-Token)
    //
    //Future apiV1AuthSignOutPost() async
    test('test apiV1AuthSignOutPost', () async {
      // TODO
    });

    // The provider returns here; the API checks the sign-in and redirects to /sign-in?step=<next step>
    //
    //Future apiV1AuthSsoProviderCallbackGet(String provider, String code, String state) async
    test('test apiV1AuthSsoProviderCallbackGet', () async {
      // TODO
    });

    // Start single sign-on with Google or Microsoft: the provider URL to open, with PKCE (sets a short-lived state cookie)
    //
    //Future<SsoStartResult> apiV1AuthSsoProviderStartPost(String provider, SsoStartInput ssoStartInput) async
    test('test apiV1AuthSsoProviderStartPost', () async {
      // TODO
    });

    // Check the authenticator or recovery code at the two-step step (needs X-CSRF-Token)
    //
    //Future<SignInResult> apiV1AuthTotpVerifyPost(TotpVerifyInput totpVerifyInput) async
    test('test apiV1AuthTotpVerifyPost', () async {
      // TODO
    });

  });
}
