// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'platform_password_sign_in_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlatformPasswordSignInInput _$PlatformPasswordSignInInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PlatformPasswordSignInInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['email', 'password']);
  final val = PlatformPasswordSignInInput(
    email: $checkedConvert('email', (v) => v as String),
    password: $checkedConvert('password', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$PlatformPasswordSignInInputToJson(
  PlatformPasswordSignInInput instance,
) => <String, dynamic>{'email': instance.email, 'password': instance.password};
