// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_preview.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MePreview _$MePreviewFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MePreview', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['roleId', 'roleName']);
      final val = MePreview(
        roleId: $checkedConvert('roleId', (v) => v as String),
        roleName: $checkedConvert('roleName', (v) => v as String),
        sampleUser: $checkedConvert(
          'sampleUser',
          (v) => v == null
              ? null
              : MePreviewSampleUser.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MePreviewToJson(MePreview instance) => <String, dynamic>{
  'roleId': instance.roleId,
  'roleName': instance.roleName,
  'sampleUser': ?instance.sampleUser?.toJson(),
};
