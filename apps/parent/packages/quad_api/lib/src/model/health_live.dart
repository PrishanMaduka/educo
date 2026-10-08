//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'health_live.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class HealthLive {
  /// Returns a new [HealthLive] instance.
  HealthLive({

    required  this.status,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final HealthLiveStatusEnum status;





    @override
    bool operator ==(Object other) => identical(this, other) || other is HealthLive &&
      other.status == status;

    @override
    int get hashCode =>
        status.hashCode;

  factory HealthLive.fromJson(Map<String, dynamic> json) => _$HealthLiveFromJson(json);

  Map<String, dynamic> toJson() => _$HealthLiveToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum HealthLiveStatusEnum {
@JsonValue(r'ok')
ok(r'ok');

const HealthLiveStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


