// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_ready.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HealthReady _$HealthReadyFromJson(Map<String, dynamic> json) =>
    $checkedCreate('HealthReady', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status', 'db', 'redis']);
      final val = HealthReady(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$HealthReadyStatusEnumEnumMap, v),
        ),
        db: $checkedConvert(
          'db',
          (v) => $enumDecode(_$HealthReadyDbEnumEnumMap, v),
        ),
        redis: $checkedConvert(
          'redis',
          (v) => $enumDecode(_$HealthReadyRedisEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$HealthReadyToJson(HealthReady instance) =>
    <String, dynamic>{
      'status': _$HealthReadyStatusEnumEnumMap[instance.status]!,
      'db': _$HealthReadyDbEnumEnumMap[instance.db]!,
      'redis': _$HealthReadyRedisEnumEnumMap[instance.redis]!,
    };

const _$HealthReadyStatusEnumEnumMap = {
  HealthReadyStatusEnum.ok: 'ok',
  HealthReadyStatusEnum.down: 'down',
};

const _$HealthReadyDbEnumEnumMap = {
  HealthReadyDbEnum.ok: 'ok',
  HealthReadyDbEnum.down: 'down',
};

const _$HealthReadyRedisEnumEnumMap = {
  HealthReadyRedisEnum.ok: 'ok',
  HealthReadyRedisEnum.down: 'down',
};
