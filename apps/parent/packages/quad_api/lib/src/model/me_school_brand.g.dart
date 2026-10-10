// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_school_brand.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSchoolBrand _$MeSchoolBrandFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeSchoolBrand', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['color', 'light', 'dark']);
      final val = MeSchoolBrand(
        color: $checkedConvert('color', (v) => v as String),
        light: $checkedConvert(
          'light',
          (v) => MeSchoolBrandLight.fromJson(v as Map<String, dynamic>),
        ),
        dark: $checkedConvert(
          'dark',
          (v) => MeSchoolBrandLight.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MeSchoolBrandToJson(MeSchoolBrand instance) =>
    <String, dynamic>{
      'color': instance.color,
      'light': instance.light.toJson(),
      'dark': instance.dark.toJson(),
    };
