//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/otp_verify_result_memberships_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'otp_verify_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OtpVerifyResult {
  /// Returns a new [OtpVerifyResult] instance.
  OtpVerifyResult({

    required  this.status,

     this.firstName,

    required  this.memberships,

     this.accessToken,

     this.refreshToken,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final OtpVerifyResultStatusEnum status;



  @JsonKey(
    
    name: r'firstName',
    required: false,
    includeIfNull: false,
  )


  final String? firstName;



  @JsonKey(
    
    name: r'memberships',
    required: true,
    includeIfNull: false,
  )


  final List<OtpVerifyResultMembershipsInner> memberships;



  @JsonKey(
    
    name: r'accessToken',
    required: false,
    includeIfNull: false,
  )


  final String? accessToken;



  @JsonKey(
    
    name: r'refreshToken',
    required: false,
    includeIfNull: false,
  )


  final String? refreshToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is OtpVerifyResult &&
      other.status == status &&
      other.firstName == firstName &&
      other.memberships == memberships &&
      other.accessToken == accessToken &&
      other.refreshToken == refreshToken;

    @override
    int get hashCode =>
        status.hashCode +
        firstName.hashCode +
        memberships.hashCode +
        accessToken.hashCode +
        refreshToken.hashCode;

  factory OtpVerifyResult.fromJson(Map<String, dynamic> json) => _$OtpVerifyResultFromJson(json);

  Map<String, dynamic> toJson() => _$OtpVerifyResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum OtpVerifyResultStatusEnum {
@JsonValue(r'signed_in')
signedIn(r'signed_in'),
@JsonValue(r'choose_school')
chooseSchool(r'choose_school'),
@JsonValue(r'not_found')
notFound(r'not_found');

const OtpVerifyResultStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


