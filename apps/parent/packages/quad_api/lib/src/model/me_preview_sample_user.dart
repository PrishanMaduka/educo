//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_preview_sample_user.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MePreviewSampleUser {
  /// Returns a new [MePreviewSampleUser] instance.
  MePreviewSampleUser({

    required  this.id,

    required  this.name,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MePreviewSampleUser &&
      other.id == id &&
      other.name == name;

    @override
    int get hashCode =>
        id.hashCode +
        name.hashCode;

  factory MePreviewSampleUser.fromJson(Map<String, dynamic> json) => _$MePreviewSampleUserFromJson(json);

  Map<String, dynamic> toJson() => _$MePreviewSampleUserToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

