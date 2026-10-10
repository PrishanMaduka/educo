// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Me _$MeFromJson(Map<String, dynamic> json) => $checkedCreate('Me', json, (
  $checkedConvert,
) {
  $checkKeys(
    json,
    requiredKeys: const ['person', 'school', 'memberships', 'greeting'],
  );
  final val = Me(
    person: $checkedConvert(
      'person',
      (v) => MePerson.fromJson(v as Map<String, dynamic>),
    ),
    school: $checkedConvert(
      'school',
      (v) => MeSchool.fromJson(v as Map<String, dynamic>),
    ),
    memberships: $checkedConvert(
      'memberships',
      (v) => (v as List<dynamic>)
          .map((e) => MeMembershipsInner.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    preview: $checkedConvert(
      'preview',
      (v) => v == null ? null : MePreview.fromJson(v as Map<String, dynamic>),
    ),
    support: $checkedConvert(
      'support',
      (v) => v == null ? null : MeSupport.fromJson(v as Map<String, dynamic>),
    ),
    greeting: $checkedConvert(
      'greeting',
      (v) => MeGreeting.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$MeToJson(Me instance) => <String, dynamic>{
  'person': instance.person.toJson(),
  'school': instance.school.toJson(),
  'memberships': instance.memberships.map((e) => e.toJson()).toList(),
  'preview': ?instance.preview?.toJson(),
  'support': ?instance.support?.toJson(),
  'greeting': instance.greeting.toJson(),
};
