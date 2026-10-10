import 'auth_fakes.dart';

typedef School = ({String id, String name, String shortName});

/// Sample schools (made-up data, D34's cast).
const School greenfield = (
  id: '0190a000-0000-7000-8000-000000000001',
  name: 'Greenfield International School',
  shortName: 'GIS',
);
const School riverside = (
  id: '0190a000-0000-7000-8000-000000000002',
  name: 'Riverside Primary',
  shortName: 'RP',
);

/// The palette the API computes for a green school (spec 03, D32).
const greenBrand = {
  'color': '#1B7F53',
  'fill': '#1B7F53',
  'fillDark': '#3FB884',
  'ink': '#FFFFFF',
};

/// `GET /me` for a parent in [school], with [others] to switch to.
Map<String, Object?> meJson({
  School school = greenfield,
  String firstName = 'Priya',
  List<School> others = const [],
  bool othersSuspended = false,
}) => {
  'person': {
    'name': '$firstName Patel',
    'firstName': firstName,
    'theme': 'system',
    'locale': 'en-LK',
    'roleNames': <String>[],
  },
  'school': {
    'id': school.id,
    'name': school.name,
    'shortName': school.shortName,
    'timeZone': 'Asia/Colombo',
    'brand': greenBrand,
  },
  'memberships': [
    for (final other in others)
      {
        'tenantId': other.id,
        'name': other.name,
        'shortName': other.shortName,
        'brandColor': null,
        'roleNames': <String>[],
        'suspended': othersSuspended,
      },
  ],
  'preview': null,
  'support': null,
  'greeting': {'period': 'morning', 'word': 'Good morning'},
};

/// One school on the picker (`OtpVerifyResult.memberships`).
Map<String, Object?> membershipJson(
  School school, {
  bool suspended = false,
  String? suspendReason,
}) => {
  'tenantId': school.id,
  'name': school.name,
  'shortName': school.shortName,
  'logoUrl': null,
  'brand': greenBrand,
  'suspended': suspended,
  'suspendReason': suspendReason,
  'kind': 'guardian',
};

const Map<String, Object> signedInJson = {
  'status': 'signed_in',
  'firstName': 'Priya',
  'memberships': <Object>[],
  'accessToken': 'a1',
  'refreshToken': 'r1',
};

Map<String, Object?> chooseSchoolJson(List<Map<String, Object?>> schools) => {
  'status': 'choose_school',
  'firstName': 'Priya',
  'memberships': schools,
  'accessToken': 'select',
};

const Map<String, Object> notFoundJson = {
  'status': 'not_found',
  'memberships': <Object>[],
};

FakeReply error(int status, String code, [Map<String, String>? fields]) =>
    FakeReply(status, {
      'code': code,
      'message': 'From the API',
      'fields': ?fields,
    });

/// The routes a sign-in needs, with [overrides] on top.
Map<String, FakeRoute> signInRoutes([
  Map<String, FakeRoute> overrides = const {},
]) => {
  'POST /api/v1/auth/otp/request': (_) => const FakeReply(202),
  'POST /api/v1/auth/otp/verify': (_) => const FakeReply(200, signedInJson),
  'GET /api/v1/me': (_) => FakeReply(200, meJson()),
  'POST /api/v1/auth/sign-out': (_) => const FakeReply(204),
  ...overrides,
};
