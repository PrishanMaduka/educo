// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'totp_setup_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TotpSetupResult _$TotpSetupResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TotpSetupResult', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['otpauthUri', 'recoveryCodes', 'next'],
      );
      final val = TotpSetupResult(
        otpauthUri: $checkedConvert('otpauthUri', (v) => v as String?),
        recoveryCodes: $checkedConvert(
          'recoveryCodes',
          (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
        ),
        next: $checkedConvert(
          'next',
          (v) => $enumDecodeNullable(_$TotpSetupResultNextEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TotpSetupResultToJson(TotpSetupResult instance) =>
    <String, dynamic>{
      'otpauthUri': instance.otpauthUri,
      'recoveryCodes': instance.recoveryCodes,
      'next': _$TotpSetupResultNextEnumEnumMap[instance.next],
    };

const _$TotpSetupResultNextEnumEnumMap = {
  TotpSetupResultNextEnum.twoStep: 'two_step',
  TotpSetupResultNextEnum.twoStepSetup: 'two_step_setup',
  TotpSetupResultNextEnum.chooseSchool: 'choose_school',
  TotpSetupResultNextEnum.noSchool: 'no_school',
  TotpSetupResultNextEnum.done: 'done',
};
