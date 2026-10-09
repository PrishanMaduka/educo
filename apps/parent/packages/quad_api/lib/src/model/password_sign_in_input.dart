//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'password_sign_in_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PasswordSignInInput {
  /// Returns a new [PasswordSignInInput] instance.
  PasswordSignInInput({

    required  this.email,

    required  this.password,

     this.keepSignedIn = false,
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



  @JsonKey(
    defaultValue: false,
    name: r'keepSignedIn',
    required: false,
    includeIfNull: false,
  )


  final bool? keepSignedIn;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PasswordSignInInput &&
      other.email == email &&
      other.password == password &&
      other.keepSignedIn == keepSignedIn;

    @override
    int get hashCode =>
        email.hashCode +
        password.hashCode +
        keepSignedIn.hashCode;

  factory PasswordSignInInput.fromJson(Map<String, dynamic> json) => _$PasswordSignInInputFromJson(json);

  Map<String, dynamic> toJson() => _$PasswordSignInInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

