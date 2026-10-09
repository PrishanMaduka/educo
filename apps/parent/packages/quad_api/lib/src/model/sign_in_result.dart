//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sign_in_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SignInResult {
  /// Returns a new [SignInResult] instance.
  SignInResult({

    required  this.next,
  });

  @JsonKey(
    
    name: r'next',
    required: true,
    includeIfNull: false,
  )


  final SignInResultNextEnum next;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInResult &&
      other.next == next;

    @override
    int get hashCode =>
        next.hashCode;

  factory SignInResult.fromJson(Map<String, dynamic> json) => _$SignInResultFromJson(json);

  Map<String, dynamic> toJson() => _$SignInResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SignInResultNextEnum {
@JsonValue(r'two_step')
twoStep(r'two_step'),
@JsonValue(r'two_step_setup')
twoStepSetup(r'two_step_setup'),
@JsonValue(r'choose_school')
chooseSchool(r'choose_school'),
@JsonValue(r'no_school')
noSchool(r'no_school'),
@JsonValue(r'done')
done(r'done');

const SignInResultNextEnum(this.value);

final String value;

@override
String toString() => value;
}


