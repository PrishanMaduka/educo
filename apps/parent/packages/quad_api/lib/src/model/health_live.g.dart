// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_live.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HealthLive _$HealthLiveFromJson(Map<String, dynamic> json) =>
    $checkedCreate('HealthLive', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status']);
      final val = HealthLive(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$HealthLiveStatusEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$HealthLiveToJson(HealthLive instance) =>
    <String, dynamic>{
      'status': _$HealthLiveStatusEnumEnumMap[instance.status]!,
    };

const _$HealthLiveStatusEnumEnumMap = {HealthLiveStatusEnum.ok: 'ok'};
