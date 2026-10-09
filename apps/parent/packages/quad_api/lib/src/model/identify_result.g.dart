// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'identify_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IdentifyResult _$IdentifyResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('IdentifyResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['methods']);
      final val = IdentifyResult(
        methods: $checkedConvert(
          'methods',
          (v) => (v as List<dynamic>)
              .map((e) => $enumDecode(_$IdentifyResultMethodsEnumEnumMap, e))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$IdentifyResultToJson(IdentifyResult instance) =>
    <String, dynamic>{
      'methods': instance.methods
          .map((e) => _$IdentifyResultMethodsEnumEnumMap[e]!)
          .toList(),
    };

const _$IdentifyResultMethodsEnumEnumMap = {
  IdentifyResultMethodsEnum.ssoColonGoogle: 'sso:google',
  IdentifyResultMethodsEnum.ssoColonMicrosoft: 'sso:microsoft',
  IdentifyResultMethodsEnum.password: 'password',
};
