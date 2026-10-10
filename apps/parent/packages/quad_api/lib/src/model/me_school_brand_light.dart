//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_school_brand_light.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeSchoolBrandLight {
  /// Returns a new [MeSchoolBrandLight] instance.
  MeSchoolBrandLight({

    required  this.fill,

    required  this.fillStrong,

    required  this.ink,

    required  this.text,

    required  this.soft,

    required  this.railActive,

    required  this.railActiveInk,
  });

  @JsonKey(
    
    name: r'fill',
    required: true,
    includeIfNull: false,
  )


  final String fill;



  @JsonKey(
    
    name: r'fillStrong',
    required: true,
    includeIfNull: false,
  )


  final String fillStrong;



  @JsonKey(
    
    name: r'ink',
    required: true,
    includeIfNull: false,
  )


  final String ink;



  @JsonKey(
    
    name: r'text',
    required: true,
    includeIfNull: false,
  )


  final String text;



  @JsonKey(
    
    name: r'soft',
    required: true,
    includeIfNull: false,
  )


  final String soft;



  @JsonKey(
    
    name: r'railActive',
    required: true,
    includeIfNull: false,
  )


  final String railActive;



  @JsonKey(
    
    name: r'railActiveInk',
    required: true,
    includeIfNull: false,
  )


  final String railActiveInk;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeSchoolBrandLight &&
      other.fill == fill &&
      other.fillStrong == fillStrong &&
      other.ink == ink &&
      other.text == text &&
      other.soft == soft &&
      other.railActive == railActive &&
      other.railActiveInk == railActiveInk;

    @override
    int get hashCode =>
        fill.hashCode +
        fillStrong.hashCode +
        ink.hashCode +
        text.hashCode +
        soft.hashCode +
        railActive.hashCode +
        railActiveInk.hashCode;

  factory MeSchoolBrandLight.fromJson(Map<String, dynamic> json) => _$MeSchoolBrandLightFromJson(json);

  Map<String, dynamic> toJson() => _$MeSchoolBrandLightToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

