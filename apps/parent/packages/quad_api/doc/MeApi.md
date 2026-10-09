# quad_api.api.MeApi

## Load the API package
```dart
import 'package:quad_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiV1MeGet**](MeApi.md#apiv1meget) | **GET** /api/v1/me | The signed-in person, their school and brand, other schools, banners and greeting
[**apiV1MePatch**](MeApi.md#apiv1mepatch) | **PATCH** /api/v1/me | Change your name, theme or locale in this school (needs X-CSRF-Token)
[**apiV1MeSessionsGet**](MeApi.md#apiv1mesessionsget) | **GET** /api/v1/me/sessions | Your signed-in devices, newest first
[**apiV1MeSessionsIdDelete**](MeApi.md#apiv1mesessionsiddelete) | **DELETE** /api/v1/me/sessions/{id} | Sign one of your devices out (needs X-CSRF-Token)
[**apiV1MeTotpPost**](MeApi.md#apiv1metotppost) | **POST** /api/v1/me/totp | Set up an authenticator: without a code it starts one, with its code it confirms it and gives the recovery codes (needs X-CSRF-Token)


# **apiV1MeGet**
> Me apiV1MeGet()

The signed-in person, their school and brand, other schools, banners and greeting

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getMeApi();

try {
    final response = api.apiV1MeGet();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->apiV1MeGet: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Me**](Me.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1MePatch**
> Me apiV1MePatch(meUpdateInput)

Change your name, theme or locale in this school (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getMeApi();
final MeUpdateInput meUpdateInput = ; // MeUpdateInput | 

try {
    final response = api.apiV1MePatch(meUpdateInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->apiV1MePatch: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **meUpdateInput** | [**MeUpdateInput**](MeUpdateInput.md)|  | 

### Return type

[**Me**](Me.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1MeSessionsGet**
> SessionSummaryList apiV1MeSessionsGet(cursor, limit)

Your signed-in devices, newest first

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getMeApi();
final String cursor = cursor_example; // String | 
final int limit = 56; // int | 

try {
    final response = api.apiV1MeSessionsGet(cursor, limit);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->apiV1MeSessionsGet: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cursor** | **String**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

### Return type

[**SessionSummaryList**](SessionSummaryList.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1MeSessionsIdDelete**
> apiV1MeSessionsIdDelete(id)

Sign one of your devices out (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getMeApi();
final String id = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 

try {
    api.apiV1MeSessionsIdDelete(id);
} catch on DioException (e) {
    print('Exception when calling MeApi->apiV1MeSessionsIdDelete: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1MeTotpPost**
> TotpSetupResult apiV1MeTotpPost(totpSetupInput)

Set up an authenticator: without a code it starts one, with its code it confirms it and gives the recovery codes (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getMeApi();
final TotpSetupInput totpSetupInput = ; // TotpSetupInput | 

try {
    final response = api.apiV1MeTotpPost(totpSetupInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->apiV1MeTotpPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **totpSetupInput** | [**TotpSetupInput**](TotpSetupInput.md)|  | 

### Return type

[**TotpSetupResult**](TotpSetupResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

