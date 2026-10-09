// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'otp_verify_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OtpVerifyResult _$OtpVerifyResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OtpVerifyResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status', 'memberships']);
      final val = OtpVerifyResult(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$OtpVerifyResultStatusEnumEnumMap, v),
        ),
        firstName: $checkedConvert('firstName', (v) => v as String?),
        memberships: $checkedConvert(
          'memberships',
          (v) => (v as List<dynamic>)
              .map(
                (e) => OtpVerifyResultMembershipsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
        accessToken: $checkedConvert('accessToken', (v) => v as String?),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$OtpVerifyResultToJson(OtpVerifyResult instance) =>
    <String, dynamic>{
      'status': _$OtpVerifyResultStatusEnumEnumMap[instance.status]!,
      'firstName': ?instance.firstName,
      'memberships': instance.memberships.map((e) => e.toJson()).toList(),
      'accessToken': ?instance.accessToken,
      'refreshToken': ?instance.refreshToken,
    };

const _$OtpVerifyResultStatusEnumEnumMap = {
  OtpVerifyResultStatusEnum.signedIn: 'signed_in',
  OtpVerifyResultStatusEnum.chooseSchool: 'choose_school',
  OtpVerifyResultStatusEnum.notFound: 'not_found',
};
