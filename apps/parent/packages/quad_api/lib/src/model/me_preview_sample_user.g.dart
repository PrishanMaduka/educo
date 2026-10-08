// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_preview_sample_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MePreviewSampleUser _$MePreviewSampleUserFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MePreviewSampleUser', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'name']);
      final val = MePreviewSampleUser(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$MePreviewSampleUserToJson(
  MePreviewSampleUser instance,
) => <String, dynamic>{'id': instance.id, 'name': instance.name};
