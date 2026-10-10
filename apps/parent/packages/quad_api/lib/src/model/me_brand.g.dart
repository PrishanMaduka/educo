// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_brand.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeBrand _$MeBrandFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeBrand', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['color', 'light', 'dark']);
      final val = MeBrand(
        color: $checkedConvert('color', (v) => v as String),
        light: $checkedConvert(
          'light',
          (v) => MeBrandTheme.fromJson(v as Map<String, dynamic>),
        ),
        dark: $checkedConvert(
          'dark',
          (v) => MeBrandTheme.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MeBrandToJson(MeBrand instance) => <String, dynamic>{
  'color': instance.color,
  'light': instance.light.toJson(),
  'dark': instance.dark.toJson(),
};
