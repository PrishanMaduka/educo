//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_brand_theme.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_brand.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeBrand {
  /// Returns a new [MeBrand] instance.
  MeBrand({

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


  final MeBrandTheme light;



  @JsonKey(
    
    name: r'dark',
    required: true,
    includeIfNull: false,
  )


  final MeBrandTheme dark;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeBrand &&
      other.color == color &&
      other.light == light &&
      other.dark == dark;

    @override
    int get hashCode =>
        color.hashCode +
        light.hashCode +
        dark.hashCode;

  factory MeBrand.fromJson(Map<String, dynamic> json) => _$MeBrandFromJson(json);

  Map<String, dynamic> toJson() => _$MeBrandToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

