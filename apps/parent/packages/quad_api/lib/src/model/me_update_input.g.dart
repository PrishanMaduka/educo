// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_update_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeUpdateInput _$MeUpdateInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeUpdateInput', json, ($checkedConvert) {
      final val = MeUpdateInput(
        name: $checkedConvert('name', (v) => v as String?),
        theme: $checkedConvert(
          'theme',
          (v) => $enumDecodeNullable(_$MeUpdateInputThemeEnumEnumMap, v),
        ),
        locale: $checkedConvert('locale', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$MeUpdateInputToJson(MeUpdateInput instance) =>
    <String, dynamic>{
      'name': ?instance.name,
      'theme': ?_$MeUpdateInputThemeEnumEnumMap[instance.theme],
      'locale': ?instance.locale,
    };

const _$MeUpdateInputThemeEnumEnumMap = {
  MeUpdateInputThemeEnum.system: 'system',
  MeUpdateInputThemeEnum.light: 'light',
  MeUpdateInputThemeEnum.dark: 'dark',
};
