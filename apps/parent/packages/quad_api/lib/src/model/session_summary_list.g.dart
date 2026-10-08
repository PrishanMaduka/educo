// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_summary_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionSummaryList _$SessionSummaryListFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SessionSummaryList', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
      final val = SessionSummaryList(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => SessionSummaryListItemsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$SessionSummaryListToJson(SessionSummaryList instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
