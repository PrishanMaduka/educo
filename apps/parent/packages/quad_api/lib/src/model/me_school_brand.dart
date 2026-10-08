//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
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

    required  this.fill,

    required  this.fillDark,

    required  this.ink,
  });

  @JsonKey(
    
    name: r'color',
    required: true,
    includeIfNull: false,
  )


  final String color;



  @JsonKey(
    
    name: r'fill',
    required: true,
    includeIfNull: false,
  )


  final String fill;



  @JsonKey(
    
    name: r'fillDark',
    required: true,
    includeIfNull: false,
  )


  final String fillDark;



  @JsonKey(
    
    name: r'ink',
    required: true,
    includeIfNull: false,
  )


  final String ink;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeSchoolBrand &&
      other.color == color &&
      other.fill == fill &&
      other.fillDark == fillDark &&
      other.ink == ink;

    @override
    int get hashCode =>
        color.hashCode +
        fill.hashCode +
        fillDark.hashCode +
        ink.hashCode;

  factory MeSchoolBrand.fromJson(Map<String, dynamic> json) => _$MeSchoolBrandFromJson(json);

  Map<String, dynamic> toJson() => _$MeSchoolBrandToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

