# quad_api.api.AuthApi

## Load the API package
```dart
import 'package:quad_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiV1AuthIdentifyPost**](AuthApi.md#apiv1authidentifypost) | **POST** /api/v1/auth/identify | The sign-in methods for a work email (the same answer whether or not it has an account)
[**apiV1AuthMembershipsGet**](AuthApi.md#apiv1authmembershipsget) | **GET** /api/v1/auth/memberships | The schools you can open (Choose a school, Switch school)
[**apiV1AuthOtpRequestPost**](AuthApi.md#apiv1authotprequestpost) | **POST** /api/v1/auth/otp/request | Send a 6-digit sign-in code to a mobile number or email (the same answer whether or not it is known)
[**apiV1AuthOtpVerifyPost**](AuthApi.md#apiv1authotpverifypost) | **POST** /api/v1/auth/otp/verify | Check the code: signs in to your one school, asks you to choose among several, or says you were not found
[**apiV1AuthPasswordForgotPost**](AuthApi.md#apiv1authpasswordforgotpost) | **POST** /api/v1/auth/password/forgot | Email a password reset link (the same answer whether or not the account exists)
[**apiV1AuthPasswordPost**](AuthApi.md#apiv1authpasswordpost) | **POST** /api/v1/auth/password | Sign in with email and password; sets the session cookies and says what comes next
[**apiV1AuthPasswordResetPost**](AuthApi.md#apiv1authpasswordresetpost) | **POST** /api/v1/auth/password/reset | Set a new password with a reset link; signs out every device
[**apiV1AuthRefreshPost**](AuthApi.md#apiv1authrefreshpost) | **POST** /api/v1/auth/refresh | Swap the refresh token for a new pair; an old refresh token signs the device out everywhere it was copied
[**apiV1AuthSelectSchoolPost**](AuthApi.md#apiv1authselectschoolpost) | **POST** /api/v1/auth/select-school | Open one of your schools. Staff: rotates the session cookie (needs X-CSRF-Token). Parent app: the select_school token gets both tokens; a school token switches and gets only the new access token (the refresh token stays)
[**apiV1AuthSignOutPost**](AuthApi.md#apiv1authsignoutpost) | **POST** /api/v1/auth/sign-out | Sign out: the staff session for every school (needs X-CSRF-Token), or the parent app’s token family on this device
[**apiV1AuthSsoProviderCallbackGet**](AuthApi.md#apiv1authssoprovidercallbackget) | **GET** /api/v1/auth/sso/{provider}/callback | The provider returns here; the API checks the sign-in and always redirects back to /sign-in
[**apiV1AuthSsoProviderStartPost**](AuthApi.md#apiv1authssoproviderstartpost) | **POST** /api/v1/auth/sso/{provider}/start | Start single sign-on with Google or Microsoft: the provider URL to open, with PKCE (sets a short-lived state cookie)
[**apiV1AuthTotpVerifyPost**](AuthApi.md#apiv1authtotpverifypost) | **POST** /api/v1/auth/totp/verify | Check the authenticator or recovery code at the two-step step (needs X-CSRF-Token)


# **apiV1AuthIdentifyPost**
> IdentifyResult apiV1AuthIdentifyPost(identifyInput)

The sign-in methods for a work email (the same answer whether or not it has an account)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final IdentifyInput identifyInput = ; // IdentifyInput | 

try {
    final response = api.apiV1AuthIdentifyPost(identifyInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthIdentifyPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **identifyInput** | [**IdentifyInput**](IdentifyInput.md)|  | 

### Return type

[**IdentifyResult**](IdentifyResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthMembershipsGet**
> SignInMembershipList apiV1AuthMembershipsGet()

The schools you can open (Choose a school, Switch school)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();

try {
    final response = api.apiV1AuthMembershipsGet();
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthMembershipsGet: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**SignInMembershipList**](SignInMembershipList.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthOtpRequestPost**
> apiV1AuthOtpRequestPost(otpRequestInput)

Send a 6-digit sign-in code to a mobile number or email (the same answer whether or not it is known)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final OtpRequestInput otpRequestInput = ; // OtpRequestInput | 

try {
    api.apiV1AuthOtpRequestPost(otpRequestInput);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthOtpRequestPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **otpRequestInput** | [**OtpRequestInput**](OtpRequestInput.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthOtpVerifyPost**
> OtpVerifyResult apiV1AuthOtpVerifyPost(otpVerifyInput)

Check the code: signs in to your one school, asks you to choose among several, or says you were not found

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final OtpVerifyInput otpVerifyInput = ; // OtpVerifyInput | 

try {
    final response = api.apiV1AuthOtpVerifyPost(otpVerifyInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthOtpVerifyPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **otpVerifyInput** | [**OtpVerifyInput**](OtpVerifyInput.md)|  | 

### Return type

[**OtpVerifyResult**](OtpVerifyResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthPasswordForgotPost**
> apiV1AuthPasswordForgotPost(passwordForgotInput)

Email a password reset link (the same answer whether or not the account exists)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final PasswordForgotInput passwordForgotInput = ; // PasswordForgotInput | 

try {
    api.apiV1AuthPasswordForgotPost(passwordForgotInput);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthPasswordForgotPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **passwordForgotInput** | [**PasswordForgotInput**](PasswordForgotInput.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthPasswordPost**
> SignInResult apiV1AuthPasswordPost(passwordSignInInput)

Sign in with email and password; sets the session cookies and says what comes next

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final PasswordSignInInput passwordSignInInput = ; // PasswordSignInInput | 

try {
    final response = api.apiV1AuthPasswordPost(passwordSignInInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthPasswordPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **passwordSignInInput** | [**PasswordSignInInput**](PasswordSignInInput.md)|  | 

### Return type

[**SignInResult**](SignInResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthPasswordResetPost**
> apiV1AuthPasswordResetPost(passwordResetInput)

Set a new password with a reset link; signs out every device

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final PasswordResetInput passwordResetInput = ; // PasswordResetInput | 

try {
    api.apiV1AuthPasswordResetPost(passwordResetInput);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthPasswordResetPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **passwordResetInput** | [**PasswordResetInput**](PasswordResetInput.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthRefreshPost**
> TokenPair apiV1AuthRefreshPost(refreshInput)

Swap the refresh token for a new pair; an old refresh token signs the device out everywhere it was copied

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final RefreshInput refreshInput = ; // RefreshInput | 

try {
    final response = api.apiV1AuthRefreshPost(refreshInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthRefreshPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshInput** | [**RefreshInput**](RefreshInput.md)|  | 

### Return type

[**TokenPair**](TokenPair.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthSelectSchoolPost**
> SelectSchoolTokens apiV1AuthSelectSchoolPost(selectSchoolInput)

Open one of your schools. Staff: rotates the session cookie (needs X-CSRF-Token). Parent app: the select_school token gets both tokens; a school token switches and gets only the new access token (the refresh token stays)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final SelectSchoolInput selectSchoolInput = ; // SelectSchoolInput | 

try {
    final response = api.apiV1AuthSelectSchoolPost(selectSchoolInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthSelectSchoolPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **selectSchoolInput** | [**SelectSchoolInput**](SelectSchoolInput.md)|  | 

### Return type

[**SelectSchoolTokens**](SelectSchoolTokens.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthSignOutPost**
> apiV1AuthSignOutPost()

Sign out: the staff session for every school (needs X-CSRF-Token), or the parent app’s token family on this device

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();

try {
    api.apiV1AuthSignOutPost();
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthSignOutPost: $e\n');
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

# **apiV1AuthSsoProviderCallbackGet**
> apiV1AuthSsoProviderCallbackGet(provider, code, state, error, errorDescription)

The provider returns here; the API checks the sign-in and always redirects back to /sign-in

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final String provider = provider_example; // String | 
final String code = code_example; // String | 
final String state = state_example; // String | 
final String error = error_example; // String | 
final String errorDescription = errorDescription_example; // String | 

try {
    api.apiV1AuthSsoProviderCallbackGet(provider, code, state, error, errorDescription);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthSsoProviderCallbackGet: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **provider** | **String**|  | 
 **code** | **String**|  | [optional] 
 **state** | **String**|  | [optional] 
 **error** | **String**|  | [optional] 
 **errorDescription** | **String**|  | [optional] 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthSsoProviderStartPost**
> SsoStartResult apiV1AuthSsoProviderStartPost(provider, ssoStartInput)

Start single sign-on with Google or Microsoft: the provider URL to open, with PKCE (sets a short-lived state cookie)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final String provider = provider_example; // String | 
final SsoStartInput ssoStartInput = ; // SsoStartInput | 

try {
    final response = api.apiV1AuthSsoProviderStartPost(provider, ssoStartInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthSsoProviderStartPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **provider** | **String**|  | 
 **ssoStartInput** | [**SsoStartInput**](SsoStartInput.md)|  | 

### Return type

[**SsoStartResult**](SsoStartResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiV1AuthTotpVerifyPost**
> SignInResult apiV1AuthTotpVerifyPost(totpVerifyInput)

Check the authenticator or recovery code at the two-step step (needs X-CSRF-Token)

### Example
```dart
import 'package:quad_api/api.dart';

final api = QuadApi().getAuthApi();
final TotpVerifyInput totpVerifyInput = ; // TotpVerifyInput | 

try {
    final response = api.apiV1AuthTotpVerifyPost(totpVerifyInput);
    print(response);
} catch on DioException (e) {
    print('Exception when calling AuthApi->apiV1AuthTotpVerifyPost: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **totpVerifyInput** | [**TotpVerifyInput**](TotpVerifyInput.md)|  | 

### Return type

[**SignInResult**](SignInResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

