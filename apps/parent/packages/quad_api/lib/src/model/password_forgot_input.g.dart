// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'password_forgot_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PasswordForgotInput _$PasswordForgotInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PasswordForgotInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['email']);
      final val = PasswordForgotInput(
        email: $checkedConvert('email', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PasswordForgotInputToJson(
  PasswordForgotInput instance,
) => <String, dynamic>{'email': instance.email};
