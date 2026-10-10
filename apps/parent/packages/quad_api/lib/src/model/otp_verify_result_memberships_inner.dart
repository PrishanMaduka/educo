//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_brand.dart';
import 'package:json_annotation/json_annotation.dart';

part 'otp_verify_result_memberships_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OtpVerifyResultMembershipsInner {
  /// Returns a new [OtpVerifyResultMembershipsInner] instance.
  OtpVerifyResultMembershipsInner({

    required  this.tenantId,

    required  this.name,

    required  this.shortName,

    required  this.logoUrl,

    required  this.brand,

    required  this.suspended,

    required  this.suspendReason,

    required  this.kind,
  });

  @JsonKey(
    
    name: r'tenantId',
    required: true,
    includeIfNull: false,
  )


  final String tenantId;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'shortName',
    required: true,
    includeIfNull: false,
  )


  final String shortName;



  @JsonKey(
    
    name: r'logoUrl',
    required: true,
    includeIfNull: true,
  )


  final String? logoUrl;



  @JsonKey(
    
    name: r'brand',
    required: true,
    includeIfNull: false,
  )


  final MeBrand brand;



  @JsonKey(
    
    name: r'suspended',
    required: true,
    includeIfNull: false,
  )


  final bool suspended;



  @JsonKey(
    
    name: r'suspendReason',
    required: true,
    includeIfNull: true,
  )


  final String? suspendReason;



  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  )


  final OtpVerifyResultMembershipsInnerKindEnum kind;





    @override
    bool operator ==(Object other) => identical(this, other) || other is OtpVerifyResultMembershipsInner &&
      other.tenantId == tenantId &&
      other.name == name &&
      other.shortName == shortName &&
      other.logoUrl == logoUrl &&
      other.brand == brand &&
      other.suspended == suspended &&
      other.suspendReason == suspendReason &&
      other.kind == kind;

    @override
    int get hashCode =>
        tenantId.hashCode +
        name.hashCode +
        shortName.hashCode +
        (logoUrl == null ? 0 : logoUrl.hashCode) +
        brand.hashCode +
        suspended.hashCode +
        (suspendReason == null ? 0 : suspendReason.hashCode) +
        kind.hashCode;

  factory OtpVerifyResultMembershipsInner.fromJson(Map<String, dynamic> json) => _$OtpVerifyResultMembershipsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$OtpVerifyResultMembershipsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum OtpVerifyResultMembershipsInnerKindEnum {
@JsonValue(r'guardian')
guardian(r'guardian'),
@JsonValue(r'relative')
relative(r'relative');

const OtpVerifyResultMembershipsInnerKindEnum(this.value);

final String value;

@override
String toString() => value;
}


