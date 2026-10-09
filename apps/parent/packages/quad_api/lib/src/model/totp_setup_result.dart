//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'totp_setup_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TotpSetupResult {
  /// Returns a new [TotpSetupResult] instance.
  TotpSetupResult({

    required  this.otpauthUri,

    required  this.recoveryCodes,

    required  this.next,
  });

  @JsonKey(
    
    name: r'otpauthUri',
    required: true,
    includeIfNull: true,
  )


  final String? otpauthUri;



  @JsonKey(
    
    name: r'recoveryCodes',
    required: true,
    includeIfNull: true,
  )


  final List<String>? recoveryCodes;



  @JsonKey(
    
    name: r'next',
    required: true,
    includeIfNull: true,
  )


  final TotpSetupResultNextEnum? next;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TotpSetupResult &&
      other.otpauthUri == otpauthUri &&
      other.recoveryCodes == recoveryCodes &&
      other.next == next;

    @override
    int get hashCode =>
        (otpauthUri == null ? 0 : otpauthUri.hashCode) +
        (recoveryCodes == null ? 0 : recoveryCodes.hashCode) +
        (next == null ? 0 : next.hashCode);

  factory TotpSetupResult.fromJson(Map<String, dynamic> json) => _$TotpSetupResultFromJson(json);

  Map<String, dynamic> toJson() => _$TotpSetupResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum TotpSetupResultNextEnum {
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

const TotpSetupResultNextEnum(this.value);

final String value;

@override
String toString() => value;
}


