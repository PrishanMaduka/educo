// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'select_school_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SelectSchoolInput _$SelectSchoolInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SelectSchoolInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['tenantId']);
      final val = SelectSchoolInput(
        tenantId: $checkedConvert('tenantId', (v) => v as String),
        remember: $checkedConvert('remember', (v) => v as bool? ?? false),
      );
      return val;
    });

Map<String, dynamic> _$SelectSchoolInputToJson(SelectSchoolInput instance) =>
    <String, dynamic>{
      'tenantId': instance.tenantId,
      'remember': ?instance.remember,
    };
