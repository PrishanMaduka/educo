//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_school_brand_light.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_school_brand.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeSchoolBrand {
  /// Returns a new [MeSchoolBrand] instance.
  MeSchoolBrand({

    required  this.color,

    required  this.light,

    required  this.dark,
  });

  @JsonKey(
    
    name: r'color',
    required: true,
    includeIfNull: false,
  )


  final String color;



  @JsonKey(
    
    name: r'light',
    required: true,
    includeIfNull: false,
  )


  final MeSchoolBrandLight light;



  @JsonKey(
    
    name: r'dark',
    required: true,
    includeIfNull: false,
  )


  final MeSchoolBrandLight dark;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeSchoolBrand &&
      other.color == color &&
      other.light == light &&
      other.dark == dark;

    @override
    int get hashCode =>
        color.hashCode +
        light.hashCode +
        dark.hashCode;

  factory MeSchoolBrand.fromJson(Map<String, dynamic> json) => _$MeSchoolBrandFromJson(json);

  Map<String, dynamic> toJson() => _$MeSchoolBrandToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

