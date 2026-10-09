// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'totp_setup_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TotpSetupInput _$TotpSetupInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TotpSetupInput', json, ($checkedConvert) {
      final val = TotpSetupInput(
        code: $checkedConvert('code', (v) => v as String?),
        inviteToken: $checkedConvert('inviteToken', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$TotpSetupInputToJson(TotpSetupInput instance) =>
    <String, dynamic>{
      'code': ?instance.code,
      'inviteToken': ?instance.inviteToken,
    };
