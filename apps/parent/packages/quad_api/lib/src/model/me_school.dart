//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_brand.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_school.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeSchool {
  /// Returns a new [MeSchool] instance.
  MeSchool({

    required  this.id,

    required  this.name,

    required  this.shortName,

    required  this.timeZone,

    required  this.brand,
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
    
    name: r'shortName',
    required: true,
    includeIfNull: false,
  )


  final String shortName;



  @JsonKey(
    
    name: r'timeZone',
    required: true,
    includeIfNull: false,
  )


  final String timeZone;



  @JsonKey(
    
    name: r'brand',
    required: true,
    includeIfNull: false,
  )


  final MeBrand brand;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeSchool &&
      other.id == id &&
      other.name == name &&
      other.shortName == shortName &&
      other.timeZone == timeZone &&
      other.brand == brand;

    @override
    int get hashCode =>
        id.hashCode +
        name.hashCode +
        shortName.hashCode +
        timeZone.hashCode +
        brand.hashCode;

  factory MeSchool.fromJson(Map<String, dynamic> json) => _$MeSchoolFromJson(json);

  Map<String, dynamic> toJson() => _$MeSchoolToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

