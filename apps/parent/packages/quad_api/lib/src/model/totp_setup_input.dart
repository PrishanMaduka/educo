//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'totp_setup_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TotpSetupInput {
  /// Returns a new [TotpSetupInput] instance.
  TotpSetupInput({

     this.code,

     this.inviteToken,
  });

  @JsonKey(
    
    name: r'code',
    required: false,
    includeIfNull: false,
  )


  final String? code;



  @JsonKey(
    
    name: r'inviteToken',
    required: false,
    includeIfNull: false,
  )


  final String? inviteToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TotpSetupInput &&
      other.code == code &&
      other.inviteToken == inviteToken;

    @override
    int get hashCode =>
        code.hashCode +
        inviteToken.hashCode;

  factory TotpSetupInput.fromJson(Map<String, dynamic> json) => _$TotpSetupInputFromJson(json);

  Map<String, dynamic> toJson() => _$TotpSetupInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

