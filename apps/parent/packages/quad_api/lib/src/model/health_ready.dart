//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'health_ready.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class HealthReady {
  /// Returns a new [HealthReady] instance.
  HealthReady({

    required  this.status,

    required  this.db,

    required  this.redis,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final HealthReadyStatusEnum status;



  @JsonKey(
    
    name: r'db',
    required: true,
    includeIfNull: false,
  )


  final HealthReadyDbEnum db;



  @JsonKey(
    
    name: r'redis',
    required: true,
    includeIfNull: false,
  )


  final HealthReadyRedisEnum redis;





    @override
    bool operator ==(Object other) => identical(this, other) || other is HealthReady &&
      other.status == status &&
      other.db == db &&
      other.redis == redis;

    @override
    int get hashCode =>
        status.hashCode +
        db.hashCode +
        redis.hashCode;

  factory HealthReady.fromJson(Map<String, dynamic> json) => _$HealthReadyFromJson(json);

  Map<String, dynamic> toJson() => _$HealthReadyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum HealthReadyStatusEnum {
@JsonValue(r'ok')
ok(r'ok'),
@JsonValue(r'down')
down(r'down');

const HealthReadyStatusEnum(this.value);

final String value;

@override
String toString() => value;
}



enum HealthReadyDbEnum {
@JsonValue(r'ok')
ok(r'ok'),
@JsonValue(r'down')
down(r'down');

const HealthReadyDbEnum(this.value);

final String value;

@override
String toString() => value;
}



enum HealthReadyRedisEnum {
@JsonValue(r'ok')
ok(r'ok'),
@JsonValue(r'down')
down(r'down');

const HealthReadyRedisEnum(this.value);

final String value;

@override
String toString() => value;
}


