// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'otp_verify_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OtpVerifyInput _$OtpVerifyInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OtpVerifyInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code']);
      final val = OtpVerifyInput(
        phone: $checkedConvert('phone', (v) => v as String?),
        email: $checkedConvert('email', (v) => v as String?),
        code: $checkedConvert('code', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$OtpVerifyInputToJson(OtpVerifyInput instance) =>
    <String, dynamic>{
      'phone': ?instance.phone,
      'email': ?instance.email,
      'code': instance.code,
    };
