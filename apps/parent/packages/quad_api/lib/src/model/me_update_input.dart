//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_update_input.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeUpdateInput {
  /// Returns a new [MeUpdateInput] instance.
  MeUpdateInput({

     this.name,

     this.theme,

     this.locale,
  });

  @JsonKey(
    
    name: r'name',
    required: false,
    includeIfNull: false,
  )


  final String? name;



  @JsonKey(
    
    name: r'theme',
    required: false,
    includeIfNull: false,
  )


  final MeUpdateInputThemeEnum? theme;



  @JsonKey(
    
    name: r'locale',
    required: false,
    includeIfNull: false,
  )


  final String? locale;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeUpdateInput &&
      other.name == name &&
      other.theme == theme &&
      other.locale == locale;

    @override
    int get hashCode =>
        name.hashCode +
        theme.hashCode +
        (locale == null ? 0 : locale.hashCode);

  factory MeUpdateInput.fromJson(Map<String, dynamic> json) => _$MeUpdateInputFromJson(json);

  Map<String, dynamic> toJson() => _$MeUpdateInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum MeUpdateInputThemeEnum {
@JsonValue(r'system')
system(r'system'),
@JsonValue(r'light')
light(r'light'),
@JsonValue(r'dark')
dark(r'dark');

const MeUpdateInputThemeEnum(this.value);

final String value;

@override
String toString() => value;
}


