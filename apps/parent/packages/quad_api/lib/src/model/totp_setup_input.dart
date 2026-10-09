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
  });

  @JsonKey(
    
    name: r'code',
    required: false,
    includeIfNull: false,
  )


  final String? code;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TotpSetupInput &&
      other.code == code;

    @override
    int get hashCode =>
        code.hashCode;

  factory TotpSetupInput.fromJson(Map<String, dynamic> json) => _$TotpSetupInputFromJson(json);

  Map<String, dynamic> toJson() => _$TotpSetupInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

