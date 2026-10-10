//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/me_support.dart';
import 'package:quad_api/src/model/me_school.dart';
import 'package:quad_api/src/model/me_preview.dart';
import 'package:quad_api/src/model/me_greeting.dart';
import 'package:quad_api/src/model/me_memberships_inner.dart';
import 'package:quad_api/src/model/me_person.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Me {
  /// Returns a new [Me] instance.
  Me({

    required  this.person,

    required  this.school,

    required  this.memberships,

     this.preview,

     this.support,

    required  this.greeting,
  });

  @JsonKey(
    
    name: r'person',
    required: true,
    includeIfNull: false,
  )


  final MePerson person;



  @JsonKey(
    
    name: r'school',
    required: true,
    includeIfNull: false,
  )


  final MeSchool school;



  @JsonKey(
    
    name: r'memberships',
    required: true,
    includeIfNull: false,
  )


  final List<MeMembershipsInner> memberships;



  @JsonKey(
    
    name: r'preview',
    required: false,
    includeIfNull: false,
  )


  final MePreview? preview;



  @JsonKey(
    
    name: r'support',
    required: false,
    includeIfNull: false,
  )


  final MeSupport? support;



  @JsonKey(
    
    name: r'greeting',
    required: true,
    includeIfNull: false,
  )


  final MeGreeting greeting;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Me &&
      other.person == person &&
      other.school == school &&
      other.memberships == memberships &&
      other.preview == preview &&
      other.support == support &&
      other.greeting == greeting;

    @override
    int get hashCode =>
        person.hashCode +
        school.hashCode +
        memberships.hashCode +
        preview.hashCode +
        support.hashCode +
        greeting.hashCode;

  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

  Map<String, dynamic> toJson() => _$MeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

