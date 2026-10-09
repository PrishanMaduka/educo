// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'platform_me.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlatformMe _$PlatformMeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PlatformMe', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'name', 'role']);
      final val = PlatformMe(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        role: $checkedConvert(
          'role',
          (v) => $enumDecode(_$PlatformMeRoleEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PlatformMeToJson(PlatformMe instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'role': _$PlatformMeRoleEnumEnumMap[instance.role]!,
    };

const _$PlatformMeRoleEnumEnumMap = {
  PlatformMeRoleEnum.owner: 'owner',
  PlatformMeRoleEnum.admin: 'admin',
  PlatformMeRoleEnum.support: 'support',
  PlatformMeRoleEnum.billing: 'billing',
  PlatformMeRoleEnum.readonly: 'readonly',
};
