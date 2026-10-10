//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_brand.dart';
import 'package:json_annotation/json_annotation.dart';

part 'sign_in_membership_list_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SignInMembershipListItemsInner {
  /// Returns a new [SignInMembershipListItemsInner] instance.
  SignInMembershipListItemsInner({

    required  this.tenantId,

    required  this.name,

    required  this.shortName,

    required  this.logoUrl,

    required  this.brand,

    required  this.roleNames,

    required  this.suspended,

    required  this.suspendReason,
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
    
    name: r'roleNames',
    required: true,
    includeIfNull: false,
  )


  final List<String> roleNames;



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





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInMembershipListItemsInner &&
      other.tenantId == tenantId &&
      other.name == name &&
      other.shortName == shortName &&
      other.logoUrl == logoUrl &&
      other.brand == brand &&
      other.roleNames == roleNames &&
      other.suspended == suspended &&
      other.suspendReason == suspendReason;

    @override
    int get hashCode =>
        tenantId.hashCode +
        name.hashCode +
        shortName.hashCode +
        (logoUrl == null ? 0 : logoUrl.hashCode) +
        brand.hashCode +
        roleNames.hashCode +
        suspended.hashCode +
        (suspendReason == null ? 0 : suspendReason.hashCode);

  factory SignInMembershipListItemsInner.fromJson(Map<String, dynamic> json) => _$SignInMembershipListItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$SignInMembershipListItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

