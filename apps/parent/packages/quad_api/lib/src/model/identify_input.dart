//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'identify_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class IdentifyInput {
  /// Returns a new [IdentifyInput] instance.
  IdentifyInput({

    required  this.email,
  });

  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: false,
  )


  final String email;





    @override
    bool operator ==(Object other) => identical(this, other) || other is IdentifyInput &&
      other.email == email;

    @override
    int get hashCode =>
        email.hashCode;

  factory IdentifyInput.fromJson(Map<String, dynamic> json) => _$IdentifyInputFromJson(json);

  Map<String, dynamic> toJson() => _$IdentifyInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

