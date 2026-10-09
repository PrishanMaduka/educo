// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'platform_totp_verify_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlatformTotpVerifyInput _$PlatformTotpVerifyInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PlatformTotpVerifyInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['code']);
  final val = PlatformTotpVerifyInput(
    code: $checkedConvert('code', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$PlatformTotpVerifyInputToJson(
  PlatformTotpVerifyInput instance,
) => <String, dynamic>{'code': instance.code};
