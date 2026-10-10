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
///
/// Each sign-in and each school switch is a new value ([school] counts
/// them), so what is loaded for a school (`GET /me`) is keyed to it and
/// never carries over to the next school.
final class SignedIn extends AuthState {
  const new({this.tenantId, this.school = 0});

  /// The school, when the app knows it: from the code's one membership, the
  /// school picker or a switch. Null after a launch until `GET /me` answers.
  final String? tenantId;

  /// Bumped on every sign-in and switch.
  final int school;

  @override
  bool operator ==(Object other) =>
      other is SignedIn && other.tenantId == tenantId && other.school == school;

  @override
  int get hashCode => Object.hash(tenantId, school);
}
