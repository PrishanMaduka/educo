// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'platform_sign_in_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlatformSignInResult _$PlatformSignInResultFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PlatformSignInResult', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['next']);
  final val = PlatformSignInResult(
    next: $checkedConvert(
      'next',
      (v) => $enumDecode(_$PlatformSignInResultNextEnumEnumMap, v),
    ),
  );
  return val;
});

Map<String, dynamic> _$PlatformSignInResultToJson(
  PlatformSignInResult instance,
) => <String, dynamic>{
  'next': _$PlatformSignInResultNextEnumEnumMap[instance.next]!,
};

const _$PlatformSignInResultNextEnumEnumMap = {
  PlatformSignInResultNextEnum.twoStep: 'two_step',
  PlatformSignInResultNextEnum.twoStepSetup: 'two_step_setup',
  PlatformSignInResultNextEnum.done: 'done',
};
