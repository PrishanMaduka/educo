// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInResult _$SignInResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SignInResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['next']);
      final val = SignInResult(
        next: $checkedConvert(
          'next',
          (v) => $enumDecode(_$SignInResultNextEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SignInResultToJson(SignInResult instance) =>
    <String, dynamic>{'next': _$SignInResultNextEnumEnumMap[instance.next]!};

const _$SignInResultNextEnumEnumMap = {
  SignInResultNextEnum.twoStep: 'two_step',
  SignInResultNextEnum.twoStepSetup: 'two_step_setup',
  SignInResultNextEnum.chooseSchool: 'choose_school',
  SignInResultNextEnum.noSchool: 'no_school',
  SignInResultNextEnum.done: 'done',
};
