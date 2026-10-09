//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_support.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeSupport {
  /// Returns a new [MeSupport] instance.
  MeSupport({

    required  this.schoolName,

    required  this.platformUserName,
  });

  @JsonKey(
    
    name: r'schoolName',
    required: true,
    includeIfNull: false,
  )


  final String schoolName;



  @JsonKey(
    
    name: r'platformUserName',
    required: true,
    includeIfNull: false,
  )


  final String platformUserName;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeSupport &&
      other.schoolName == schoolName &&
      other.platformUserName == platformUserName;

    @override
    int get hashCode =>
        schoolName.hashCode +
        platformUserName.hashCode;

  factory MeSupport.fromJson(Map<String, dynamic> json) => _$MeSupportFromJson(json);

  Map<String, dynamic> toJson() => _$MeSupportToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

