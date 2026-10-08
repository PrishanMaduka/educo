// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_summary_list_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionSummaryListItemsInner _$SessionSummaryListItemsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SessionSummaryListItemsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'kind',
      'deviceName',
      'userAgent',
      'createdAt',
      'lastSeenAt',
      'current',
    ],
  );
  final val = SessionSummaryListItemsInner(
    id: $checkedConvert('id', (v) => v as String),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(_$SessionSummaryListItemsInnerKindEnumEnumMap, v),
    ),
    deviceName: $checkedConvert('deviceName', (v) => v as String?),
    userAgent: $checkedConvert('userAgent', (v) => v as String?),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    lastSeenAt: $checkedConvert(
      'lastSeenAt',
      (v) => DateTime.parse(v as String),
    ),
    current: $checkedConvert('current', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SessionSummaryListItemsInnerToJson(
  SessionSummaryListItemsInner instance,
) => <String, dynamic>{
  'id': instance.id,
  'kind': _$SessionSummaryListItemsInnerKindEnumEnumMap[instance.kind]!,
  'deviceName': instance.deviceName,
  'userAgent': instance.userAgent,
  'createdAt': instance.createdAt.toIso8601String(),
  'lastSeenAt': instance.lastSeenAt.toIso8601String(),
  'current': instance.current,
};

const _$SessionSummaryListItemsInnerKindEnumEnumMap = {
  SessionSummaryListItemsInnerKindEnum.web: 'web',
  SessionSummaryListItemsInnerKindEnum.mobile: 'mobile',
};
