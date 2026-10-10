import 'package:flutter/foundation.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/token_interceptor.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'sign_in_flow.g.dart';

/// A country the phone step accepts (spec 05 step 2). Only Sri Lanka for now
/// (OQ12); adding one is an owner decision (D35) and a row here.
@immutable
class SignInCountry {
  const new({required this.iso, required this.dialCode});

  final String iso;
  final String dialCode;
}

const signInCountries = [SignInCountry(iso: 'LK', dialCode: '+94')];

/// Who the code goes to: a mobile number with its country code, or an email
/// ("Use email instead"). Exactly one is set.
@immutable
class SignInSubject {
  const new phone(String this.phone) : email = null;

  const new email(String this.email) : phone = null;

  final String? phone;
  final String? email;
}

/// Where the parent is in the sign-in steps: whom the code went to and what
/// the code found.
@immutable
class SignInFlowState {
  const new({this.subject, this.result});

  final SignInSubject? subject;
  final OtpVerifyResult? result;
}

/// The phone, code and Found you steps (spec 05 Parent app steps 2 to 4).
/// Tokens are the [AuthController]'s; this keeps only what the screens show.
@Riverpod(keepAlive: true)
class SignInFlow extends _$SignInFlow {
  @override
  SignInFlowState build() => const SignInFlowState();

  /// Asks the API to send a code to [subject]. The answer is the same
  /// whether or not the number is known (D39).
  Future<void> requestCode(SignInSubject subject) async {
    await ref
        .read(quadApiProvider)
        .getAuthApi()
        .apiV1AuthOtpRequestPost(
          otpRequestInput: OtpRequestInput(
            phone: subject.phone,
            email: subject.email,
          ),
          extra: const {TokenInterceptor.skipAuth: true},
        );
    state = SignInFlowState(subject: subject);
  }

  /// Sends the code again to the same number or address.
  Future<void> resend() async {
    final subject = state.subject;
    if (subject == null) throw StateError('No code was asked for yet.');
    await requestCode(subject);
  }

  /// Checks [code]; API errors (such as `invalid_code`) are the caller's.
  Future<OtpVerifyResult> verify(String code) async {
    final subject = state.subject;
    if (subject == null) throw StateError('No code was asked for yet.');
    final result = await ref
        .read(authControllerProvider.notifier)
        .verifyCode(
          OtpVerifyInput(
            phone: subject.phone,
            email: subject.email,
            code: code,
          ),
        );
    state = SignInFlowState(subject: subject, result: result);
    return result;
  }
}
