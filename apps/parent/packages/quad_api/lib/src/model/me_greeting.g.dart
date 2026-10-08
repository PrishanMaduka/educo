// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_greeting.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeGreeting _$MeGreetingFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeGreeting', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['period', 'word']);
      final val = MeGreeting(
        period: $checkedConvert(
          'period',
          (v) => $enumDecode(_$MeGreetingPeriodEnumEnumMap, v),
        ),
        word: $checkedConvert(
          'word',
          (v) => $enumDecode(_$MeGreetingWordEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MeGreetingToJson(MeGreeting instance) =>
    <String, dynamic>{
      'period': _$MeGreetingPeriodEnumEnumMap[instance.period]!,
      'word': _$MeGreetingWordEnumEnumMap[instance.word]!,
    };

const _$MeGreetingPeriodEnumEnumMap = {
  MeGreetingPeriodEnum.morning: 'morning',
  MeGreetingPeriodEnum.afternoon: 'afternoon',
  MeGreetingPeriodEnum.evening: 'evening',
  MeGreetingPeriodEnum.night: 'night',
};

const _$MeGreetingWordEnumEnumMap = {
  MeGreetingWordEnum.goodMorning: 'Good morning',
  MeGreetingWordEnum.goodAfternoon: 'Good afternoon',
  MeGreetingWordEnum.goodEvening: 'Good evening',
  MeGreetingWordEnum.hello: 'Hello',
};
