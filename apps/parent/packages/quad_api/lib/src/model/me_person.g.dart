// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_person.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MePerson _$MePersonFromJson(Map<String, dynamic> json) => $checkedCreate(
  'MePerson',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['name', 'firstName', 'theme', 'locale', 'roleNames'],
    );
    final val = MePerson(
      name: $checkedConvert('name', (v) => v as String),
      firstName: $checkedConvert('firstName', (v) => v as String),
      theme: $checkedConvert(
        'theme',
        (v) => $enumDecode(_$MePersonThemeEnumEnumMap, v),
      ),
      locale: $checkedConvert('locale', (v) => v as String),
      roleNames: $checkedConvert(
        'roleNames',
        (v) => (v as List<dynamic>).map((e) => e as String).toList(),
      ),
    );
    return val;
  },
);

Map<String, dynamic> _$MePersonToJson(MePerson instance) => <String, dynamic>{
  'name': instance.name,
  'firstName': instance.firstName,
  'theme': _$MePersonThemeEnumEnumMap[instance.theme]!,
  'locale': instance.locale,
  'roleNames': instance.roleNames,
};

const _$MePersonThemeEnumEnumMap = {
  MePersonThemeEnum.system: 'system',
  MePersonThemeEnum.light: 'light',
  MePersonThemeEnum.dark: 'dark',
};
