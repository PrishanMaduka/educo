// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'otp_request_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OtpRequestInput _$OtpRequestInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OtpRequestInput', json, ($checkedConvert) {
      final val = OtpRequestInput(
        phone: $checkedConvert('phone', (v) => v as String?),
        email: $checkedConvert('email', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$OtpRequestInputToJson(OtpRequestInput instance) =>
    <String, dynamic>{'phone': ?instance.phone, 'email': ?instance.email};
