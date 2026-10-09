//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'session_summary_list_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SessionSummaryListItemsInner {
  /// Returns a new [SessionSummaryListItemsInner] instance.
  SessionSummaryListItemsInner({

    required  this.id,

    required  this.kind,

    required  this.deviceName,

    required  this.userAgent,

    required  this.createdAt,

    required  this.lastSeenAt,

    required  this.current,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  )


  final SessionSummaryListItemsInnerKindEnum kind;



  @JsonKey(
    
    name: r'deviceName',
    required: true,
    includeIfNull: true,
  )


  final String? deviceName;



  @JsonKey(
    
    name: r'userAgent',
    required: true,
    includeIfNull: true,
  )


  final String? userAgent;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;



  @JsonKey(
    
    name: r'lastSeenAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime lastSeenAt;



  @JsonKey(
    
    name: r'current',
    required: true,
    includeIfNull: false,
  )


  final bool current;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SessionSummaryListItemsInner &&
      other.id == id &&
      other.kind == kind &&
      other.deviceName == deviceName &&
      other.userAgent == userAgent &&
      other.createdAt == createdAt &&
      other.lastSeenAt == lastSeenAt &&
      other.current == current;

    @override
    int get hashCode =>
        id.hashCode +
        kind.hashCode +
        (deviceName == null ? 0 : deviceName.hashCode) +
        (userAgent == null ? 0 : userAgent.hashCode) +
        createdAt.hashCode +
        lastSeenAt.hashCode +
        current.hashCode;

  factory SessionSummaryListItemsInner.fromJson(Map<String, dynamic> json) => _$SessionSummaryListItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$SessionSummaryListItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SessionSummaryListItemsInnerKindEnum {
@JsonValue(r'web')
web(r'web'),
@JsonValue(r'mobile')
mobile(r'mobile');

const SessionSummaryListItemsInnerKindEnum(this.value);

final String value;

@override
String toString() => value;
}


