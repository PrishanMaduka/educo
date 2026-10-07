// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sns_envelope.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SnsEnvelope _$SnsEnvelopeFromJson(Map<String, dynamic> json) => $checkedCreate(
  'SnsEnvelope',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'Type',
        'MessageId',
        'TopicArn',
        'Message',
        'Timestamp',
        'SignatureVersion',
        'Signature',
        'SigningCertURL',
      ],
    );
    final val = SnsEnvelope(
      type: $checkedConvert(
        'Type',
        (v) => $enumDecode(_$SnsEnvelopeTypeEnumEnumMap, v),
      ),
      messageId: $checkedConvert('MessageId', (v) => v as String),
      topicArn: $checkedConvert('TopicArn', (v) => v as String),
      message: $checkedConvert('Message', (v) => v as String),
      timestamp: $checkedConvert(
        'Timestamp',
        (v) => DateTime.parse(v as String),
      ),
      signatureVersion: $checkedConvert('SignatureVersion', (v) => v as String),
      signature: $checkedConvert('Signature', (v) => v as String),
      signingCertURL: $checkedConvert('SigningCertURL', (v) => v as String),
      subject: $checkedConvert('Subject', (v) => v as String?),
      subscribeURL: $checkedConvert('SubscribeURL', (v) => v as String?),
      token: $checkedConvert('Token', (v) => v as String?),
    );
    return val;
  },
  fieldKeyMap: const {
    'type': 'Type',
    'messageId': 'MessageId',
    'topicArn': 'TopicArn',
    'message': 'Message',
    'timestamp': 'Timestamp',
    'signatureVersion': 'SignatureVersion',
    'signature': 'Signature',
    'signingCertURL': 'SigningCertURL',
    'subject': 'Subject',
    'subscribeURL': 'SubscribeURL',
    'token': 'Token',
  },
);

Map<String, dynamic> _$SnsEnvelopeToJson(SnsEnvelope instance) =>
    <String, dynamic>{
      'Type': _$SnsEnvelopeTypeEnumEnumMap[instance.type]!,
      'MessageId': instance.messageId,
      'TopicArn': instance.topicArn,
      'Message': instance.message,
      'Timestamp': instance.timestamp.toIso8601String(),
      'SignatureVersion': instance.signatureVersion,
      'Signature': instance.signature,
      'SigningCertURL': instance.signingCertURL,
      'Subject': ?instance.subject,
      'SubscribeURL': ?instance.subscribeURL,
      'Token': ?instance.token,
    };

const _$SnsEnvelopeTypeEnumEnumMap = {
  SnsEnvelopeTypeEnum.notification: 'Notification',
  SnsEnvelopeTypeEnum.subscriptionConfirmation: 'SubscriptionConfirmation',
  SnsEnvelopeTypeEnum.unsubscribeConfirmation: 'UnsubscribeConfirmation',
};
