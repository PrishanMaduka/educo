//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'password_forgot_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PasswordForgotInput {
  /// Returns a new [PasswordForgotInput] instance.
  PasswordForgotInput({

    required  this.email,
  });

  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: false,
  )


  final String email;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PasswordForgotInput &&
      other.email == email;

    @override
    int get hashCode =>
        email.hashCode;

  factory PasswordForgotInput.fromJson(Map<String, dynamic> json) => _$PasswordForgotInputFromJson(json);

  Map<String, dynamic> toJson() => _$PasswordForgotInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

