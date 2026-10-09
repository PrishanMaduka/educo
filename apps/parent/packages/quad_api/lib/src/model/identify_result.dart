//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'identify_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class IdentifyResult {
  /// Returns a new [IdentifyResult] instance.
  IdentifyResult({

    required  this.methods,
  });

  @JsonKey(
    
    name: r'methods',
    required: true,
    includeIfNull: false,
  )


  final List<IdentifyResultMethodsEnum> methods;





    @override
    bool operator ==(Object other) => identical(this, other) || other is IdentifyResult &&
      other.methods == methods;

    @override
    int get hashCode =>
        methods.hashCode;

  factory IdentifyResult.fromJson(Map<String, dynamic> json) => _$IdentifyResultFromJson(json);

  Map<String, dynamic> toJson() => _$IdentifyResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum IdentifyResultMethodsEnum {
@JsonValue(r'sso:google')
ssoColonGoogle(r'sso:google'),
@JsonValue(r'sso:microsoft')
ssoColonMicrosoft(r'sso:microsoft'),
@JsonValue(r'password')
password(r'password');

const IdentifyResultMethodsEnum(this.value);

final String value;

@override
String toString() => value;
}


