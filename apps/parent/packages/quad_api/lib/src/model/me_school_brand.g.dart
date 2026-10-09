// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_school_brand.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSchoolBrand _$MeSchoolBrandFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeSchoolBrand', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['color', 'fill', 'fillDark', 'ink'],
      );
      final val = MeSchoolBrand(
        color: $checkedConvert('color', (v) => v as String),
        fill: $checkedConvert('fill', (v) => v as String),
        fillDark: $checkedConvert('fillDark', (v) => v as String),
        ink: $checkedConvert('ink', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$MeSchoolBrandToJson(MeSchoolBrand instance) =>
    <String, dynamic>{
      'color': instance.color,
      'fill': instance.fill,
      'fillDark': instance.fillDark,
      'ink': instance.ink,
    };
