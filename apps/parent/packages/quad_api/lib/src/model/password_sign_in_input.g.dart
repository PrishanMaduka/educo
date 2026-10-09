// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'password_sign_in_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PasswordSignInInput _$PasswordSignInInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PasswordSignInInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['email', 'password']);
      final val = PasswordSignInInput(
        email: $checkedConvert('email', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
        keepSignedIn: $checkedConvert(
          'keepSignedIn',
          (v) => v as bool? ?? false,
        ),
        inviteToken: $checkedConvert('inviteToken', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$PasswordSignInInputToJson(
  PasswordSignInInput instance,
) => <String, dynamic>{
  'email': instance.email,
  'password': instance.password,
  'keepSignedIn': ?instance.keepSignedIn,
  'inviteToken': ?instance.inviteToken,
};
