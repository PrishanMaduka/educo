//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sso_start_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SsoStartInput {
  /// Returns a new [SsoStartInput] instance.
  SsoStartInput({

    required  this.email,

     this.keepSignedIn = false,
  });

  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: false,
  )


  final String email;



  @JsonKey(
    defaultValue: false,
    name: r'keepSignedIn',
    required: false,
    includeIfNull: false,
  )


  final bool? keepSignedIn;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SsoStartInput &&
      other.email == email &&
      other.keepSignedIn == keepSignedIn;

    @override
    int get hashCode =>
        email.hashCode +
        keepSignedIn.hashCode;

  factory SsoStartInput.fromJson(Map<String, dynamic> json) => _$SsoStartInputFromJson(json);

  Map<String, dynamic> toJson() => _$SsoStartInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

