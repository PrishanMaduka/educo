//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'ses_webhook_ack.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SesWebhookAck {
  /// Returns a new [SesWebhookAck] instance.
  SesWebhookAck({

    required  this.status,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final SesWebhookAckStatusEnum status;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SesWebhookAck &&
      other.status == status;

    @override
    int get hashCode =>
        status.hashCode;

  factory SesWebhookAck.fromJson(Map<String, dynamic> json) => _$SesWebhookAckFromJson(json);

  Map<String, dynamic> toJson() => _$SesWebhookAckToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SesWebhookAckStatusEnum {
@JsonValue(r'ok')
ok(r'ok');

const SesWebhookAckStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


