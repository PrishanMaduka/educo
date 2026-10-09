//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_person.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MePerson {
  /// Returns a new [MePerson] instance.
  MePerson({

    required  this.name,

    required  this.firstName,

    required  this.theme,

    required  this.locale,
  });

  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'firstName',
    required: true,
    includeIfNull: false,
  )


  final String firstName;



  @JsonKey(
    
    name: r'theme',
    required: true,
    includeIfNull: false,
  )


  final MePersonThemeEnum theme;



  @JsonKey(
    
    name: r'locale',
    required: true,
    includeIfNull: false,
  )


  final String locale;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MePerson &&
      other.name == name &&
      other.firstName == firstName &&
      other.theme == theme &&
      other.locale == locale;

    @override
    int get hashCode =>
        name.hashCode +
        firstName.hashCode +
        theme.hashCode +
        locale.hashCode;

  factory MePerson.fromJson(Map<String, dynamic> json) => _$MePersonFromJson(json);

  Map<String, dynamic> toJson() => _$MePersonToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum MePersonThemeEnum {
@JsonValue(r'system')
system(r'system'),
@JsonValue(r'light')
light(r'light'),
@JsonValue(r'dark')
dark(r'dark');

const MePersonThemeEnum(this.value);

final String value;

@override
String toString() => value;
}


