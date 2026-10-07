//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sns_envelope.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SnsEnvelope {
  /// Returns a new [SnsEnvelope] instance.
  SnsEnvelope({

    required  this.type,

    required  this.messageId,

    required  this.topicArn,

    required  this.message,

    required  this.timestamp,

    required  this.signatureVersion,

    required  this.signature,

    required  this.signingCertURL,

     this.subject,

     this.subscribeURL,

     this.token,
  });

  @JsonKey(
    
    name: r'Type',
    required: true,
    includeIfNull: false,
  )


  final SnsEnvelopeTypeEnum type;



  @JsonKey(
    
    name: r'MessageId',
    required: true,
    includeIfNull: false,
  )


  final String messageId;



  @JsonKey(
    
    name: r'TopicArn',
    required: true,
    includeIfNull: false,
  )


  final String topicArn;



  @JsonKey(
    
    name: r'Message',
    required: true,
    includeIfNull: false,
  )


  final String message;



  @JsonKey(
    
    name: r'Timestamp',
    required: true,
    includeIfNull: false,
  )


  final DateTime timestamp;



  @JsonKey(
    
    name: r'SignatureVersion',
    required: true,
    includeIfNull: false,
  )


  final String signatureVersion;



  @JsonKey(
    
    name: r'Signature',
    required: true,
    includeIfNull: false,
  )


  final String signature;



  @JsonKey(
    
    name: r'SigningCertURL',
    required: true,
    includeIfNull: false,
  )


  final String signingCertURL;



  @JsonKey(
    
    name: r'Subject',
    required: false,
    includeIfNull: false,
  )


  final String? subject;



  @JsonKey(
    
    name: r'SubscribeURL',
    required: false,
    includeIfNull: false,
  )


  final String? subscribeURL;



  @JsonKey(
    
    name: r'Token',
    required: false,
    includeIfNull: false,
  )


  final String? token;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SnsEnvelope &&
      other.type == type &&
      other.messageId == messageId &&
      other.topicArn == topicArn &&
      other.message == message &&
      other.timestamp == timestamp &&
      other.signatureVersion == signatureVersion &&
      other.signature == signature &&
      other.signingCertURL == signingCertURL &&
      other.subject == subject &&
      other.subscribeURL == subscribeURL &&
      other.token == token;

    @override
    int get hashCode =>
        type.hashCode +
        messageId.hashCode +
        topicArn.hashCode +
        message.hashCode +
        timestamp.hashCode +
        signatureVersion.hashCode +
        signature.hashCode +
        signingCertURL.hashCode +
        subject.hashCode +
        subscribeURL.hashCode +
        token.hashCode;

  factory SnsEnvelope.fromJson(Map<String, dynamic> json) => _$SnsEnvelopeFromJson(json);

  Map<String, dynamic> toJson() => _$SnsEnvelopeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SnsEnvelopeTypeEnum {
@JsonValue(r'Notification')
notification(r'Notification'),
@JsonValue(r'SubscriptionConfirmation')
subscriptionConfirmation(r'SubscriptionConfirmation'),
@JsonValue(r'UnsubscribeConfirmation')
unsubscribeConfirmation(r'UnsubscribeConfirmation');

const SnsEnvelopeTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


