//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'platform_sign_in_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlatformSignInResult {
  /// Returns a new [PlatformSignInResult] instance.
  PlatformSignInResult({

    required  this.next,
  });

  @JsonKey(
    
    name: r'next',
    required: true,
    includeIfNull: false,
  )


  final PlatformSignInResultNextEnum next;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PlatformSignInResult &&
      other.next == next;

    @override
    int get hashCode =>
        next.hashCode;

  factory PlatformSignInResult.fromJson(Map<String, dynamic> json) => _$PlatformSignInResultFromJson(json);

  Map<String, dynamic> toJson() => _$PlatformSignInResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum PlatformSignInResultNextEnum {
@JsonValue(r'two_step')
twoStep(r'two_step'),
@JsonValue(r'two_step_setup')
twoStepSetup(r'two_step_setup'),
@JsonValue(r'done')
done(r'done');

const PlatformSignInResultNextEnum(this.value);

final String value;

@override
String toString() => value;
}


