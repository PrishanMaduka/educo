import 'package:test/test.dart';
import 'package:quad_api/quad_api.dart';


/// tests for WebhooksApi
void main() {
  final instance = QuadApi().getWebhooksApi();

  group(WebhooksApi, () {
    // SES bounce and complaint events from SNS (signature version 2, pinned topic)
    //
    //Future<SesWebhookAck> apiV1WebhooksSesPost(SnsEnvelope snsEnvelope) async
    test('test apiV1WebhooksSesPost', () async {
      // TODO
    });

  });
}
