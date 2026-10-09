//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'platform_totp_setup.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlatformTotpSetup {
  /// Returns a new [PlatformTotpSetup] instance.
  PlatformTotpSetup({

    required  this.secret,

    required  this.otpauthUri,
  });

  @JsonKey(
    
    name: r'secret',
    required: true,
    includeIfNull: false,
  )


  final String secret;



  @JsonKey(
    
    name: r'otpauthUri',
    required: true,
    includeIfNull: false,
  )


  final String otpauthUri;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PlatformTotpSetup &&
      other.secret == secret &&
      other.otpauthUri == otpauthUri;

    @override
    int get hashCode =>
        secret.hashCode +
        otpauthUri.hashCode;

  factory PlatformTotpSetup.fromJson(Map<String, dynamic> json) => _$PlatformTotpSetupFromJson(json);

  Map<String, dynamic> toJson() => _$PlatformTotpSetupToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

