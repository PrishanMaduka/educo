//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_preview_sample_user.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_preview.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MePreview {
  /// Returns a new [MePreview] instance.
  MePreview({

    required  this.roleId,

    required  this.roleName,

    required  this.sampleUser,
  });

  @JsonKey(
    
    name: r'roleId',
    required: true,
    includeIfNull: false,
  )


  final String roleId;



  @JsonKey(
    
    name: r'roleName',
    required: true,
    includeIfNull: false,
  )


  final String roleName;



  @JsonKey(
    
    name: r'sampleUser',
    required: true,
    includeIfNull: false,
  )


  final MePreviewSampleUser sampleUser;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MePreview &&
      other.roleId == roleId &&
      other.roleName == roleName &&
      other.sampleUser == sampleUser;

    @override
    int get hashCode =>
        roleId.hashCode +
        roleName.hashCode +
        sampleUser.hashCode;

  factory MePreview.fromJson(Map<String, dynamic> json) => _$MePreviewFromJson(json);

  Map<String, dynamic> toJson() => _$MePreviewToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

