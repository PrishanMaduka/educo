// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ses_webhook_ack.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SesWebhookAck _$SesWebhookAckFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SesWebhookAck', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status']);
      final val = SesWebhookAck(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$SesWebhookAckStatusEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SesWebhookAckToJson(SesWebhookAck instance) =>
    <String, dynamic>{
      'status': _$SesWebhookAckStatusEnumEnumMap[instance.status]!,
    };

const _$SesWebhookAckStatusEnumEnumMap = {SesWebhookAckStatusEnum.ok: 'ok'};
