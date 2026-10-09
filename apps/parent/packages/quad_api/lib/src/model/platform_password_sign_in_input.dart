//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'platform_password_sign_in_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlatformPasswordSignInInput {
  /// Returns a new [PlatformPasswordSignInInput] instance.
  PlatformPasswordSignInInput({

    required  this.email,

    required  this.password,
  });

  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: false,
  )


  final String email;



  @JsonKey(
    
    name: r'password',
    required: true,
    includeIfNull: false,
  )


  final String password;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PlatformPasswordSignInInput &&
      other.email == email &&
      other.password == password;

    @override
    int get hashCode =>
        email.hashCode +
        password.hashCode;

  factory PlatformPasswordSignInInput.fromJson(Map<String, dynamic> json) => _$PlatformPasswordSignInInputFromJson(json);

  Map<String, dynamic> toJson() => _$PlatformPasswordSignInInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

