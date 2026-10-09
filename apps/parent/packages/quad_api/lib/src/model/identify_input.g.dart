// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'identify_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IdentifyInput _$IdentifyInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('IdentifyInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['email']);
      final val = IdentifyInput(
        email: $checkedConvert('email', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$IdentifyInputToJson(IdentifyInput instance) =>
    <String, dynamic>{'email': instance.email};
