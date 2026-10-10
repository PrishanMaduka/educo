// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'otp_verify_result_memberships_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OtpVerifyResultMembershipsInner _$OtpVerifyResultMembershipsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('OtpVerifyResultMembershipsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'tenantId',
      'name',
      'shortName',
      'logoUrl',
      'brand',
      'suspended',
      'suspendReason',
      'kind',
    ],
  );
  final val = OtpVerifyResultMembershipsInner(
    tenantId: $checkedConvert('tenantId', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    shortName: $checkedConvert('shortName', (v) => v as String),
    logoUrl: $checkedConvert('logoUrl', (v) => v as String?),
    brand: $checkedConvert(
      'brand',
      (v) => MeBrand.fromJson(v as Map<String, dynamic>),
    ),
    suspended: $checkedConvert('suspended', (v) => v as bool),
    suspendReason: $checkedConvert('suspendReason', (v) => v as String?),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(_$OtpVerifyResultMembershipsInnerKindEnumEnumMap, v),
    ),
  );
  return val;
});

Map<String, dynamic> _$OtpVerifyResultMembershipsInnerToJson(
  OtpVerifyResultMembershipsInner instance,
) => <String, dynamic>{
  'tenantId': instance.tenantId,
  'name': instance.name,
  'shortName': instance.shortName,
  'logoUrl': instance.logoUrl,
  'brand': instance.brand.toJson(),
  'suspended': instance.suspended,
  'suspendReason': instance.suspendReason,
  'kind': _$OtpVerifyResultMembershipsInnerKindEnumEnumMap[instance.kind]!,
};

const _$OtpVerifyResultMembershipsInnerKindEnumEnumMap = {
  OtpVerifyResultMembershipsInnerKindEnum.guardian: 'guardian',
  OtpVerifyResultMembershipsInnerKindEnum.relative: 'relative',
};
