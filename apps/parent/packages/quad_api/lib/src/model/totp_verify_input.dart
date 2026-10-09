//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'totp_verify_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TotpVerifyInput {
  /// Returns a new [TotpVerifyInput] instance.
  TotpVerifyInput({

     this.code,

     this.recoveryCode,

     this.trustDevice = false,
  });

  @JsonKey(
    
    name: r'code',
    required: false,
    includeIfNull: false,
  )


  final String? code;



  @JsonKey(
    
    name: r'recoveryCode',
    required: false,
    includeIfNull: false,
  )


  final String? recoveryCode;



  @JsonKey(
    defaultValue: false,
    name: r'trustDevice',
    required: false,
    includeIfNull: false,
  )


  final bool? trustDevice;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TotpVerifyInput &&
      other.code == code &&
      other.recoveryCode == recoveryCode &&
      other.trustDevice == trustDevice;

    @override
    int get hashCode =>
        code.hashCode +
        recoveryCode.hashCode +
        trustDevice.hashCode;

  factory TotpVerifyInput.fromJson(Map<String, dynamic> json) => _$TotpVerifyInputFromJson(json);

  Map<String, dynamic> toJson() => _$TotpVerifyInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

