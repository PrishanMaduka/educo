# quad_api.api.HealthApi

## Load the API package
```dart
import 'package:quad_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiV1HealthLiveGet**](HealthApi.md#apiv1healthliveget) | **GET** /api/v1/health/live | The process is up
[**apiV1HealthReadyGet**](HealthApi.md#apiv1healthreadyget) | **GET** /api/v1/health/ready | Postgres and Redis answer


# **apiV1HealthLiveGet**
> HealthLive apiV1HealthLiveGet()

The process is up

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getHealthApi();

try {
    final response = api.apiV1HealthLiveGet();
    print(response);
} catch on DioException (e) {
    print('Exception when calling HealthApi->apiV1HealthLiveGet: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**HealthLive**](HealthLive.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1HealthReadyGet**
> HealthReady apiV1HealthReadyGet()

Postgres and Redis answer

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getHealthApi();

try {
    final response = api.apiV1HealthReadyGet();
    print(response);
} catch on DioException (e) {
    print('Exception when calling HealthApi->apiV1HealthReadyGet: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**HealthReady**](HealthReady.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

