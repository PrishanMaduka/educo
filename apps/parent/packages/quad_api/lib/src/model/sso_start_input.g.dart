// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sso_start_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SsoStartInput _$SsoStartInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SsoStartInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['email']);
      final val = SsoStartInput(
        email: $checkedConvert('email', (v) => v as String),
        keepSignedIn: $checkedConvert(
          'keepSignedIn',
          (v) => v as bool? ?? false,
        ),
      );
      return val;
    });

Map<String, dynamic> _$SsoStartInputToJson(SsoStartInput instance) =>
    <String, dynamic>{
      'email': instance.email,
      'keepSignedIn': ?instance.keepSignedIn,
    };
