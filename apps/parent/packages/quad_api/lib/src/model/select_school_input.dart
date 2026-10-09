//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'select_school_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SelectSchoolInput {
  /// Returns a new [SelectSchoolInput] instance.
  SelectSchoolInput({

    required  this.tenantId,

     this.remember = false,
  });

  @JsonKey(
    
    name: r'tenantId',
    required: true,
    includeIfNull: false,
  )


  final String tenantId;



  @JsonKey(
    defaultValue: false,
    name: r'remember',
    required: false,
    includeIfNull: false,
  )


  final bool? remember;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SelectSchoolInput &&
      other.tenantId == tenantId &&
      other.remember == remember;

    @override
    int get hashCode =>
        tenantId.hashCode +
        remember.hashCode;

  factory SelectSchoolInput.fromJson(Map<String, dynamic> json) => _$SelectSchoolInputFromJson(json);

  Map<String, dynamic> toJson() => _$SelectSchoolInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

