// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_support.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSupport _$MeSupportFromJson(Map<String, dynamic> json) => $checkedCreate(
  'MeSupport',
  json,
  ($checkedConvert) {
    $checkKeys(json, requiredKeys: const ['schoolName', 'platformUserName']);
    final val = MeSupport(
      schoolName: $checkedConvert('schoolName', (v) => v as String),
      platformUserName: $checkedConvert('platformUserName', (v) => v as String),
    );
    return val;
  },
);

Map<String, dynamic> _$MeSupportToJson(MeSupport instance) => <String, dynamic>{
  'schoolName': instance.schoolName,
  'platformUserName': instance.platformUserName,
};
