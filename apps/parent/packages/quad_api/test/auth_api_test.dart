import 'package:test/test.dart';
import 'package:quad_api/quad_api.dart';


/// tests for AuthApi
void main() {
  final instance = QuadApi().getAuthApi();

  group(AuthApi, () {
    // The schools you can open (Choose a school, Switch school)
    //
    //Future<SignInMembershipList> apiV1AuthMembershipsGet() async
    test('test apiV1AuthMembershipsGet', () async {
      // TODO
    });

    // Send a 6-digit sign-in code to a mobile number or email (the same answer whether or not it is known)
    //
    //Future apiV1AuthOtpRequestPost(OtpRequestInput otpRequestInput) async
    test('test apiV1AuthOtpRequestPost', () async {
      // TODO
    });

    // Check the code: signs in to your one school, asks you to choose among several, or says you were not found
    //
    //Future<OtpVerifyResult> apiV1AuthOtpVerifyPost(OtpVerifyInput otpVerifyInput) async
    test('test apiV1AuthOtpVerifyPost', () async {
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

    // Swap the refresh token for a new pair; an old refresh token signs the device out everywhere it was copied
    //
    //Future<TokenPair> apiV1AuthRefreshPost(RefreshInput refreshInput) async
    test('test apiV1AuthRefreshPost', () async {
      // TODO
    });

    // Open one of your schools. Staff: rotates the session cookie (needs X-CSRF-Token). Parent app: the select_school token gets both tokens; a school token switches and gets only the new access token (the refresh token stays)
    //
    //Future<SelectSchoolTokens> apiV1AuthSelectSchoolPost(SelectSchoolInput selectSchoolInput) async
    test('test apiV1AuthSelectSchoolPost', () async {
      // TODO
    });

    // Sign out: the staff session for every school (needs X-CSRF-Token), or the parent app’s token family on this device
    //
    //Future apiV1AuthSignOutPost() async
    test('test apiV1AuthSignOutPost', () async {
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
