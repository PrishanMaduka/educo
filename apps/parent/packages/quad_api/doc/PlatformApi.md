# quad_api.api.PlatformApi

## Load the API package
```dart
import 'package:quad_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiV1PlatformAuthPasswordPost**](PlatformApi.md#apiv1platformauthpasswordpost) | **POST** /api/v1/platform/auth/password | Console: sign in with email and password; sets the console cookies and asks for the authenticator code (or to set one up)
[**apiV1PlatformAuthSignOutPost**](PlatformApi.md#apiv1platformauthsignoutpost) | **POST** /api/v1/platform/auth/sign-out | Console: sign out this browser and clear the console cookies (needs X-CSRF-Token)
[**apiV1PlatformAuthTotpSetupPost**](PlatformApi.md#apiv1platformauthtotpsetuppost) | **POST** /api/v1/platform/auth/totp/setup | Console, first sign-in: a new authenticator secret and its otpauth URI, shown once (needs X-CSRF-Token)
[**apiV1PlatformAuthTotpVerifyPost**](PlatformApi.md#apiv1platformauthtotpverifypost) | **POST** /api/v1/platform/auth/totp/verify | Console: check the authenticator code (or the first code of a new one) and open the console on a new cookie (needs X-CSRF-Token)
[**apiV1PlatformMeGet**](PlatformApi.md#apiv1platformmeget) | **GET** /api/v1/platform/me | Console: the signed-in Quad staff member’s name and role


# **apiV1PlatformAuthPasswordPost**
> PlatformSignInResult apiV1PlatformAuthPasswordPost(platformPasswordSignInInput)

Console: sign in with email and password; sets the console cookies and asks for the authenticator code (or to set one up)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getPlatformApi();
final PlatformPasswordSignInInput platformPasswordSignInInput = ; // PlatformPasswordSignInInput | 

try {
    final response = api.apiV1PlatformAuthPasswordPost(platformPasswordSignInInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling PlatformApi->apiV1PlatformAuthPasswordPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platformPasswordSignInInput** | [**PlatformPasswordSignInInput**](PlatformPasswordSignInInput.md)|  | 

### Return type

[**PlatformSignInResult**](PlatformSignInResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1PlatformAuthSignOutPost**
> apiV1PlatformAuthSignOutPost()

Console: sign out this browser and clear the console cookies (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getPlatformApi();

try {
    api.apiV1PlatformAuthSignOutPost();
} catch on DioException (e) {
    print('Exception when calling PlatformApi->apiV1PlatformAuthSignOutPost: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1PlatformAuthTotpSetupPost**
> PlatformTotpSetup apiV1PlatformAuthTotpSetupPost()

Console, first sign-in: a new authenticator secret and its otpauth URI, shown once (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getPlatformApi();

try {
    final response = api.apiV1PlatformAuthTotpSetupPost();
    print(response);
} catch on DioException (e) {
    print('Exception when calling PlatformApi->apiV1PlatformAuthTotpSetupPost: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**PlatformTotpSetup**](PlatformTotpSetup.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1PlatformAuthTotpVerifyPost**
> PlatformSignInResult apiV1PlatformAuthTotpVerifyPost(platformTotpVerifyInput)

Console: check the authenticator code (or the first code of a new one) and open the console on a new cookie (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getPlatformApi();
final PlatformTotpVerifyInput platformTotpVerifyInput = ; // PlatformTotpVerifyInput | 

try {
    final response = api.apiV1PlatformAuthTotpVerifyPost(platformTotpVerifyInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling PlatformApi->apiV1PlatformAuthTotpVerifyPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platformTotpVerifyInput** | [**PlatformTotpVerifyInput**](PlatformTotpVerifyInput.md)|  | 

### Return type

[**PlatformSignInResult**](PlatformSignInResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1PlatformMeGet**
> PlatformMe apiV1PlatformMeGet()

Console: the signed-in Quad staff member’s name and role

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getPlatformApi();

try {
    final response = api.apiV1PlatformMeGet();
    print(response);
} catch on DioException (e) {
    print('Exception when calling PlatformApi->apiV1PlatformMeGet: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**PlatformMe**](PlatformMe.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

