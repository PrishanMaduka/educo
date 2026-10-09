// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_membership_list_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInMembershipListItemsInner _$SignInMembershipListItemsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SignInMembershipListItemsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'tenantId',
      'name',
      'shortName',
      'logoUrl',
      'brand',
      'roleNames',
      'suspended',
      'suspendReason',
    ],
  );
  final val = SignInMembershipListItemsInner(
    tenantId: $checkedConvert('tenantId', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    shortName: $checkedConvert('shortName', (v) => v as String),
    logoUrl: $checkedConvert('logoUrl', (v) => v as String?),
    brand: $checkedConvert(
      'brand',
      (v) => MeSchoolBrand.fromJson(v as Map<String, dynamic>),
    ),
    roleNames: $checkedConvert(
      'roleNames',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    suspended: $checkedConvert('suspended', (v) => v as bool),
    suspendReason: $checkedConvert('suspendReason', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$SignInMembershipListItemsInnerToJson(
  SignInMembershipListItemsInner instance,
) => <String, dynamic>{
  'tenantId': instance.tenantId,
  'name': instance.name,
  'shortName': instance.shortName,
  'logoUrl': instance.logoUrl,
  'brand': instance.brand.toJson(),
  'roleNames': instance.roleNames,
  'suspended': instance.suspended,
  'suspendReason': instance.suspendReason,
};
