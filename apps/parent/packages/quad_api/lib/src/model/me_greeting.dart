//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_greeting.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeGreeting {
  /// Returns a new [MeGreeting] instance.
  MeGreeting({

    required  this.period,

    required  this.word,
  });

  @JsonKey(
    
    name: r'period',
    required: true,
    includeIfNull: false,
  )


  final MeGreetingPeriodEnum period;



  @JsonKey(
    
    name: r'word',
    required: true,
    includeIfNull: false,
  )


  final MeGreetingWordEnum word;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeGreeting &&
      other.period == period &&
      other.word == word;

    @override
    int get hashCode =>
        period.hashCode +
        word.hashCode;

  factory MeGreeting.fromJson(Map<String, dynamic> json) => _$MeGreetingFromJson(json);

  Map<String, dynamic> toJson() => _$MeGreetingToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum MeGreetingPeriodEnum {
@JsonValue(r'morning')
morning(r'morning'),
@JsonValue(r'afternoon')
afternoon(r'afternoon'),
@JsonValue(r'evening')
evening(r'evening'),
@JsonValue(r'night')
night(r'night');

const MeGreetingPeriodEnum(this.value);

final String value;

@override
String toString() => value;
}



enum MeGreetingWordEnum {
@JsonValue(r'Good morning')
goodMorning(r'Good morning'),
@JsonValue(r'Good afternoon')
goodAfternoon(r'Good afternoon'),
@JsonValue(r'Good evening')
goodEvening(r'Good evening'),
@JsonValue(r'Hello')
hello(r'Hello');

const MeGreetingWordEnum(this.value);

final String value;

@override
String toString() => value;
}


