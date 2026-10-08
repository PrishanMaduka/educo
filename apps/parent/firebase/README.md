# Firebase for the parent app

Push arrives in M6 (spec 12). The `firebase_core` and `firebase_messaging`
packages and the `com.google.gms.google-services` Gradle plugin are added then.
M0b only reserves where each flavor's client config goes and keeps the
staging and production files out of git (spec 02, Parent app configuration).

## Projects

There is one Firebase project per environment, so test pushes never reach real
parents (spec 20, Push; D19).

| Flavor | Firebase project | Android app (`google-services.json`) | iOS app (`GoogleService-Info.plist`) |
|---|---|---|---|
| `dev` | `quad-dev` | `com.quadedu.parent.dev` | `com.quadedu.parent.dev` |
| `staging` | `quad-staging` | `com.quadedu.parent.staging` | `com.quadedu.parent.staging` |
| `prod` | `quad-prod` (M12) | `com.quadedu.parent` | `com.quadedu.parent` |

## Where each file goes

| Platform | Path (under `apps/parent`) | In git? |
|---|---|---|
| Android | `android/app/src/<flavor>/google-services.json` | No (git-ignored for every flavor) |
| iOS | `ios/config/<flavor>/GoogleService-Info.plist` | No (git-ignored for every flavor) |

The Android Gradle plugin picks the file from the flavor's source set. In M6, a
build phase on the iOS Runner target copies the flavor's plist into the app.

Locally, download the `quad-dev` files from the Firebase console into those
paths. In CI, the `staging` files come from the GitHub `staging` environment
secrets as base64 (`GOOGLE_SERVICE_INFO_PLIST_B64` for iOS, which the
`ios staging` lane writes; in M6, an Android equivalent written by
`android staging_build`). See [fastlane/README.md](../fastlane/README.md).

## APNs

iOS push goes through APNs via Firebase. In Apple Developer, create one APNs
auth key (`.p8`) with the Apple Push Notifications service enabled. Upload it in
each Firebase project (Project settings → Cloud Messaging → Apple app
configuration), with its key id and the team id. The `.p8` is never committed.
Keep it in the team's password manager, since Apple lets you download it only
once. The push entitlements on `com.quadedu.parent` and its flavors arrive with
M6.

## Server side

The API sends with FCM HTTP v1 through `firebase-admin` and a service account
per project (spec 12, spec 20). That credential is an API secret, separate from
these client configs.
