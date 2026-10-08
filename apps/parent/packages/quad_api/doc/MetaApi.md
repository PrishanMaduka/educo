# quad_api.api.MetaApi

## Load the API package
```dart
import 'package:quad_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiV1OpenapiJsonGet**](MetaApi.md#apiv1openapijsonget) | **GET** /api/v1/openapi.json | This OpenAPI document


# **apiV1OpenapiJsonGet**
> Map<String, Object> apiV1OpenapiJsonGet()

This OpenAPI document

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getMetaApi();

try {
    final response = api.apiV1OpenapiJsonGet();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MetaApi->apiV1OpenapiJsonGet: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Map&lt;String, Object&gt;**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

