//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'password_reset_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PasswordResetInput {
  /// Returns a new [PasswordResetInput] instance.
  PasswordResetInput({

    required  this.token,

    required  this.password,
  });

  @JsonKey(
    
    name: r'token',
    required: true,
    includeIfNull: false,
  )


  final String token;



  @JsonKey(
    
    name: r'password',
    required: true,
    includeIfNull: false,
  )


  final String password;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PasswordResetInput &&
      other.token == token &&
      other.password == password;

    @override
    int get hashCode =>
        token.hashCode +
        password.hashCode;

  factory PasswordResetInput.fromJson(Map<String, dynamic> json) => _$PasswordResetInputFromJson(json);

  Map<String, dynamic> toJson() => _$PasswordResetInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

