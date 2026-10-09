//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'otp_request_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OtpRequestInput {
  /// Returns a new [OtpRequestInput] instance.
  OtpRequestInput({

     this.phone,

     this.email,
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





    @override
    bool operator ==(Object other) => identical(this, other) || other is OtpRequestInput &&
      other.phone == phone &&
      other.email == email;

    @override
    int get hashCode =>
        phone.hashCode +
        email.hashCode;

  factory OtpRequestInput.fromJson(Map<String, dynamic> json) => _$OtpRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$OtpRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

