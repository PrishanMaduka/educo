import 'package:quad_api/src/model/error_body.dart';
import 'package:quad_api/src/model/health_live.dart';
import 'package:quad_api/src/model/health_ready.dart';
import 'package:quad_api/src/model/identify_input.dart';
import 'package:quad_api/src/model/identify_result.dart';
import 'package:quad_api/src/model/me.dart';
import 'package:quad_api/src/model/me_greeting.dart';
import 'package:quad_api/src/model/me_memberships_inner.dart';
import 'package:quad_api/src/model/me_person.dart';
import 'package:quad_api/src/model/me_preview.dart';
import 'package:quad_api/src/model/me_preview_sample_user.dart';
import 'package:quad_api/src/model/me_school.dart';
import 'package:quad_api/src/model/me_school_brand.dart';
import 'package:quad_api/src/model/me_support.dart';
import 'package:quad_api/src/model/me_update_input.dart';
import 'package:quad_api/src/model/password_forgot_input.dart';
import 'package:quad_api/src/model/password_reset_input.dart';
import 'package:quad_api/src/model/password_sign_in_input.dart';
import 'package:quad_api/src/model/select_school_input.dart';
import 'package:quad_api/src/model/ses_webhook_ack.dart';
import 'package:quad_api/src/model/session_summary_list.dart';
import 'package:quad_api/src/model/session_summary_list_items_inner.dart';
import 'package:quad_api/src/model/sign_in_membership_list.dart';
import 'package:quad_api/src/model/sign_in_membership_list_items_inner.dart';
import 'package:quad_api/src/model/sign_in_result.dart';
import 'package:quad_api/src/model/sns_envelope.dart';
import 'package:quad_api/src/model/totp_setup_input.dart';
import 'package:quad_api/src/model/totp_setup_result.dart';
import 'package:quad_api/src/model/totp_verify_input.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

  ReturnType deserialize<ReturnType, BaseType>(dynamic value, String targetType, {bool growable= true}) {
      switch (targetType) {
        case 'String':
          return '$value' as ReturnType;
        case 'int':
          return (value is int ? value : int.parse('$value')) as ReturnType;
        case 'bool':
          if (value is bool) {
            return value as ReturnType;
          }
          final valueString = '$value'.toLowerCase();
          return (valueString == 'true' || valueString == '1') as ReturnType;
        case 'double':
          return (value is double ? value : double.parse('$value')) as ReturnType;
        case 'ErrorBody':
          return ErrorBody.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'HealthLive':
          return HealthLive.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'HealthReady':
          return HealthReady.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'IdentifyInput':
          return IdentifyInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'IdentifyResult':
          return IdentifyResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Me':
          return Me.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeGreeting':
          return MeGreeting.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeMembershipsInner':
          return MeMembershipsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MePerson':
          return MePerson.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MePreview':
          return MePreview.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MePreviewSampleUser':
          return MePreviewSampleUser.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeSchool':
          return MeSchool.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeSchoolBrand':
          return MeSchoolBrand.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeSupport':
          return MeSupport.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeUpdateInput':
          return MeUpdateInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PasswordForgotInput':
          return PasswordForgotInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PasswordResetInput':
          return PasswordResetInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PasswordSignInInput':
          return PasswordSignInInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SelectSchoolInput':
          return SelectSchoolInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SesWebhookAck':
          return SesWebhookAck.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SessionSummaryList':
          return SessionSummaryList.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SessionSummaryListItemsInner':
          return SessionSummaryListItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SignInMembershipList':
          return SignInMembershipList.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SignInMembershipListItemsInner':
          return SignInMembershipListItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SignInResult':
          return SignInResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SnsEnvelope':
          return SnsEnvelope.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'TotpSetupInput':
          return TotpSetupInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'TotpSetupResult':
          return TotpSetupResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'TotpVerifyInput':
          return TotpVerifyInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        default:
          RegExpMatch? match;

          if (value is List && (match = _regList.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toList(growable: growable) as ReturnType;
          }
          if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toSet() as ReturnType;
          }
          if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
            targetType = match![1]!.trim(); // ignore: parameter_assignments
            return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable)),
            ) as ReturnType;
          }
          break;
    }
    throw Exception('Cannot deserialize');
  }