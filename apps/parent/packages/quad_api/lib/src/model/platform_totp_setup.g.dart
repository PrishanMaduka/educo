// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'platform_totp_setup.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlatformTotpSetup _$PlatformTotpSetupFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PlatformTotpSetup', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['secret', 'otpauthUri']);
      final val = PlatformTotpSetup(
        secret: $checkedConvert('secret', (v) => v as String),
        otpauthUri: $checkedConvert('otpauthUri', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PlatformTotpSetupToJson(PlatformTotpSetup instance) =>
    <String, dynamic>{
      'secret': instance.secret,
      'otpauthUri': instance.otpauthUri,
    };
