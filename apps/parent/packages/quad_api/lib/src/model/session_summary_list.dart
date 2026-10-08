//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/session_summary_list_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'session_summary_list.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SessionSummaryList {
  /// Returns a new [SessionSummaryList] instance.
  SessionSummaryList({

    required  this.items,

    required  this.nextCursor,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<SessionSummaryListItemsInner> items;



  @JsonKey(
    
    name: r'nextCursor',
    required: true,
    includeIfNull: true,
  )


  final String? nextCursor;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SessionSummaryList &&
      other.items == items &&
      other.nextCursor == nextCursor;

    @override
    int get hashCode =>
        items.hashCode +
        (nextCursor == null ? 0 : nextCursor.hashCode);

  factory SessionSummaryList.fromJson(Map<String, dynamic> json) => _$SessionSummaryListFromJson(json);

  Map<String, dynamic> toJson() => _$SessionSummaryListToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

