import 'package:flutter/foundation.dart';
import 'package:quad_api/quad_api.dart';

/// Where the parent is in signing in (spec 05 Parent app). The router reads
/// it to send a signed-out parent to Welcome; tokens never appear here.
@immutable
sealed class AuthState {
  const new();
}

/// Launch: the refresh token is being read from secure storage.
final class AuthRestoring extends AuthState {
  const new();
}

/// No token family on this device.
final class SignedOut extends AuthState {
  const new();
}

/// The code was right and the account has several schools (or one that is
/// suspended): the parent picks one within 5 minutes (`select_school`).
final class ChoosingSchool extends AuthState {
  const new({required this.firstName, required this.memberships});

  final String? firstName;
  final List<OtpVerifyResultMembershipsInner> memberships;
}

/// Signed in to one school; the refresh token is in secure storage.
final class SignedIn extends AuthState {
  const new();
}
