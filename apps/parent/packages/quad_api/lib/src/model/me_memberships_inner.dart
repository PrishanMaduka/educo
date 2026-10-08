//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_memberships_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeMembershipsInner {
  /// Returns a new [MeMembershipsInner] instance.
  MeMembershipsInner({

    required  this.tenantId,

    required  this.name,

    required  this.shortName,

    required  this.brandColor,

    required  this.roleNames,

    required  this.suspended,
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
    
    name: r'brandColor',
    required: true,
    includeIfNull: true,
  )


  final String? brandColor;



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





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeMembershipsInner &&
      other.tenantId == tenantId &&
      other.name == name &&
      other.shortName == shortName &&
      other.brandColor == brandColor &&
      other.roleNames == roleNames &&
      other.suspended == suspended;

    @override
    int get hashCode =>
        tenantId.hashCode +
        name.hashCode +
        shortName.hashCode +
        (brandColor == null ? 0 : brandColor.hashCode) +
        roleNames.hashCode +
        suspended.hashCode;

  factory MeMembershipsInner.fromJson(Map<String, dynamic> json) => _$MeMembershipsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$MeMembershipsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

