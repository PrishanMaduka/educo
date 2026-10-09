// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_memberships_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeMembershipsInner _$MeMembershipsInnerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeMembershipsInner', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'tenantId',
          'name',
          'shortName',
          'brandColor',
          'roleNames',
          'suspended',
        ],
      );
      final val = MeMembershipsInner(
        tenantId: $checkedConvert('tenantId', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        shortName: $checkedConvert('shortName', (v) => v as String),
        brandColor: $checkedConvert('brandColor', (v) => v as String?),
        roleNames: $checkedConvert(
          'roleNames',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        suspended: $checkedConvert('suspended', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$MeMembershipsInnerToJson(MeMembershipsInner instance) =>
    <String, dynamic>{
      'tenantId': instance.tenantId,
      'name': instance.name,
      'shortName': instance.shortName,
      'brandColor': instance.brandColor,
      'roleNames': instance.roleNames,
      'suspended': instance.suspended,
    };
