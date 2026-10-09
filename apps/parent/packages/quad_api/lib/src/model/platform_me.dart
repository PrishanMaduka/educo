//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'platform_me.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlatformMe {
  /// Returns a new [PlatformMe] instance.
  PlatformMe({

    required  this.id,

    required  this.name,

    required  this.role,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'role',
    required: true,
    includeIfNull: false,
  )


  final PlatformMeRoleEnum role;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PlatformMe &&
      other.id == id &&
      other.name == name &&
      other.role == role;

    @override
    int get hashCode =>
        id.hashCode +
        name.hashCode +
        role.hashCode;

  factory PlatformMe.fromJson(Map<String, dynamic> json) => _$PlatformMeFromJson(json);

  Map<String, dynamic> toJson() => _$PlatformMeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum PlatformMeRoleEnum {
@JsonValue(r'owner')
owner(r'owner'),
@JsonValue(r'admin')
admin(r'admin'),
@JsonValue(r'support')
support(r'support'),
@JsonValue(r'billing')
billing(r'billing'),
@JsonValue(r'readonly')
readonly(r'readonly');

const PlatformMeRoleEnum(this.value);

final String value;

@override
String toString() => value;
}


