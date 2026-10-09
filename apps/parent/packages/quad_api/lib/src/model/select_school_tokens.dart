//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'select_school_tokens.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SelectSchoolTokens {
  /// Returns a new [SelectSchoolTokens] instance.
  SelectSchoolTokens({

    required  this.accessToken,

     this.refreshToken,
  });

  @JsonKey(
    
    name: r'accessToken',
    required: true,
    includeIfNull: false,
  )


  final String accessToken;



  @JsonKey(
    
    name: r'refreshToken',
    required: false,
    includeIfNull: false,
  )


  final String? refreshToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SelectSchoolTokens &&
      other.accessToken == accessToken &&
      other.refreshToken == refreshToken;

    @override
    int get hashCode =>
        accessToken.hashCode +
        refreshToken.hashCode;

  factory SelectSchoolTokens.fromJson(Map<String, dynamic> json) => _$SelectSchoolTokensFromJson(json);

  Map<String, dynamic> toJson() => _$SelectSchoolTokensToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

