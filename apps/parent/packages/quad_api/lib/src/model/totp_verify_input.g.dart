// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'totp_verify_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TotpVerifyInput _$TotpVerifyInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TotpVerifyInput', json, ($checkedConvert) {
      final val = TotpVerifyInput(
        code: $checkedConvert('code', (v) => v as String?),
        recoveryCode: $checkedConvert('recoveryCode', (v) => v as String?),
        trustDevice: $checkedConvert('trustDevice', (v) => v as bool? ?? false),
        inviteToken: $checkedConvert('inviteToken', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$TotpVerifyInputToJson(TotpVerifyInput instance) =>
    <String, dynamic>{
      'code': ?instance.code,
      'recoveryCode': ?instance.recoveryCode,
      'trustDevice': ?instance.trustDevice,
      'inviteToken': ?instance.inviteToken,
    };
