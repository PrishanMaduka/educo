//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'otp_verify_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OtpVerifyInput {
  /// Returns a new [OtpVerifyInput] instance.
  OtpVerifyInput({

     this.phone,

     this.email,

    required  this.code,
  });

  @JsonKey(
    
    name: r'phone',
    required: false,
    includeIfNull: false,
  )


  final String? phone;



  @JsonKey(
    
    name: r'email',
    required: false,
    includeIfNull: false,
  )


  final String? email;



  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;





    @override
    bool operator ==(Object other) => identical(this, other) || other is OtpVerifyInput &&
      other.phone == phone &&
      other.email == email &&
      other.code == code;

    @override
    int get hashCode =>
        phone.hashCode +
        email.hashCode +
        code.hashCode;

  factory OtpVerifyInput.fromJson(Map<String, dynamic> json) => _$OtpVerifyInputFromJson(json);

  Map<String, dynamic> toJson() => _$OtpVerifyInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

