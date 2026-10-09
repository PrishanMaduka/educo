// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'select_school_tokens.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SelectSchoolTokens _$SelectSchoolTokensFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SelectSchoolTokens', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['accessToken']);
      final val = SelectSchoolTokens(
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$SelectSchoolTokensToJson(SelectSchoolTokens instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': ?instance.refreshToken,
    };
