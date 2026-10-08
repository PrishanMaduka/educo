# quad_api.api.WebhooksApi

## Load the API package
```dart
import 'package:quad_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiV1WebhooksSesPost**](WebhooksApi.md#apiv1webhookssespost) | **POST** /api/v1/webhooks/ses | SES bounce and complaint events from SNS (signature version 2, pinned topic)


# **apiV1WebhooksSesPost**
> SesWebhookAck apiV1WebhooksSesPost(snsEnvelope)

SES bounce and complaint events from SNS (signature version 2, pinned topic)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getWebhooksApi();
final SnsEnvelope snsEnvelope = ; // SnsEnvelope | 

try {
    final response = api.apiV1WebhooksSesPost(snsEnvelope);
    print(response);
} catch on DioException (e) {
    print('Exception when calling WebhooksApi->apiV1WebhooksSesPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **snsEnvelope** | [**SnsEnvelope**](SnsEnvelope.md)|  | 

### Return type

[**SesWebhookAck**](SesWebhookAck.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

