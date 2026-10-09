//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'platform_totp_verify_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlatformTotpVerifyInput {
  /// Returns a new [PlatformTotpVerifyInput] instance.
  PlatformTotpVerifyInput({

    required  this.code,
  });

  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PlatformTotpVerifyInput &&
      other.code == code;

    @override
    int get hashCode =>
        code.hashCode;

  factory PlatformTotpVerifyInput.fromJson(Map<String, dynamic> json) => _$PlatformTotpVerifyInputFromJson(json);

  Map<String, dynamic> toJson() => _$PlatformTotpVerifyInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

