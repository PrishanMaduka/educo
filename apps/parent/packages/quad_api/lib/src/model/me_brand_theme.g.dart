// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_brand_theme.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeBrandTheme _$MeBrandThemeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeBrandTheme', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'fill',
          'fillStrong',
          'ink',
          'text',
          'soft',
          'railActive',
          'railActiveInk',
        ],
      );
      final val = MeBrandTheme(
        fill: $checkedConvert('fill', (v) => v as String),
        fillStrong: $checkedConvert('fillStrong', (v) => v as String),
        ink: $checkedConvert('ink', (v) => v as String),
        text: $checkedConvert('text', (v) => v as String),
        soft: $checkedConvert('soft', (v) => v as String),
        railActive: $checkedConvert('railActive', (v) => v as String),
        railActiveInk: $checkedConvert('railActiveInk', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$MeBrandThemeToJson(MeBrandTheme instance) =>
    <String, dynamic>{
      'fill': instance.fill,
      'fillStrong': instance.fillStrong,
      'ink': instance.ink,
      'text': instance.text,
      'soft': instance.soft,
      'railActive': instance.railActive,
      'railActiveInk': instance.railActiveInk,
    };
