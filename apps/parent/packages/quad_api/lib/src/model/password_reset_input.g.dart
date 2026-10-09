// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'password_reset_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PasswordResetInput _$PasswordResetInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PasswordResetInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['token', 'password']);
      final val = PasswordResetInput(
        token: $checkedConvert('token', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PasswordResetInputToJson(PasswordResetInput instance) =>
    <String, dynamic>{'token': instance.token, 'password': instance.password};
