//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sso_start_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SsoStartResult {
  /// Returns a new [SsoStartResult] instance.
  SsoStartResult({

    required  this.url,
  });

  @JsonKey(
    
    name: r'url',
    required: true,
    includeIfNull: false,
  )


  final String url;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SsoStartResult &&
      other.url == url;

    @override
    int get hashCode =>
        url.hashCode;

  factory SsoStartResult.fromJson(Map<String, dynamic> json) => _$SsoStartResultFromJson(json);

  Map<String, dynamic> toJson() => _$SsoStartResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

