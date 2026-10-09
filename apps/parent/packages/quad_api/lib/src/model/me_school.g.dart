// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_school.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSchool _$MeSchoolFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeSchool', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['id', 'name', 'shortName', 'timeZone', 'brand'],
      );
      final val = MeSchool(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        shortName: $checkedConvert('shortName', (v) => v as String),
        timeZone: $checkedConvert('timeZone', (v) => v as String),
        brand: $checkedConvert(
          'brand',
          (v) => MeSchoolBrand.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MeSchoolToJson(MeSchool instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'shortName': instance.shortName,
  'timeZone': instance.timeZone,
  'brand': instance.brand.toJson(),
};
