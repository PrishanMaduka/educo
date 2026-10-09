// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sso_start_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SsoStartResult _$SsoStartResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SsoStartResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['url']);
      final val = SsoStartResult(
        url: $checkedConvert('url', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SsoStartResultToJson(SsoStartResult instance) =>
    <String, dynamic>{'url': instance.url};
