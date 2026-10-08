# Parent app store lanes

fastlane builds the parent app's `staging` flavor and uploads it to TestFlight
and the Play internal track (spec 20, App store publishing; D28). CI runs these
lanes in `deploy-staging.yml` (`parent-ios` on a macOS runner, `parent-android`)
when `vars.IOS_UPLOAD_ENABLED` or `vars.PLAY_UPLOAD_ENABLED` is `true`.

## Setup

From `apps/parent`, with Ruby 3.3 and Flutter on `PATH`:

```bash
bundle config set --local path vendor/bundle   # git-ignored
bundle install
bundle exec fastlane lanes
```

`Gemfile` pins `fastlane` 2.240.1, and `Gemfile.lock` covers Linux and macOS.

## Lanes

| Lane | What it does |
|---|---|
| `ios staging` | `setup_ci`, then `match` (App Store profile for `com.quadedu.parent.staging`, read-only). Switches `Release-staging` to manual signing with that profile, writes `ios/config/staging/GoogleService-Info.plist` when `GOOGLE_SERVICE_INFO_PLIST_B64` is set, runs `flutter build ipa --flavor staging --release --dart-define-from-file=env/staging.json --export-method app-store`, and uploads to TestFlight without waiting for processing |
| `android staging_build` | When all four `ANDROID_*` signing variables are set, writes `android/key.properties` and `android/upload-keystore.jks` (mode 600). Then runs `flutter build appbundle --flavor staging --release --dart-define-from-file=env/staging.json`. Without the variables, Gradle signs with the debug keys and the lane says so |
| `android staging` | Refuses to run without the signing variables, since Play rejects a debug-signed bundle. Runs `staging_build`, then uploads the bundle to the `internal` track of `com.quadedu.parent.staging` as a draft. Store metadata, changelogs and images are not uploaded |

Each build takes its store build number from `BUILD_NUMBER` when it is set (CI passes `github.run_number`), so every upload is newer than the last. Without it, the `+N` in `pubspec.yaml` is used.

## Credentials

Credentials come only from environment variables or match, never from git. In
CI they are the GitHub `staging-stores` environment secrets (spec 20); AWS holds none
of them. The files the lanes write are git-ignored (`apps/parent/.gitignore`).

| Variable | Used by | What it is |
|---|---|---|
| `MATCH_GIT_URL` | `ios staging` | The private match certificates repository |
| `MATCH_PASSWORD` | `ios staging` | match's encryption passphrase |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `ios staging` | Base64 of `user:token` with read access to that repository |
| `ASC_KEY_ID`, `ASC_ISSUER_ID` | `ios staging` | App Store Connect API key id and issuer |
| `ASC_KEY_P8_B64` | `ios staging` | Base64 of the API key's `.p8` |
| `GOOGLE_SERVICE_INFO_PLIST_B64` | `ios staging` (optional) | Base64 of the `quad-staging` iOS Firebase config ([firebase/README.md](../firebase/README.md)) |
| `ANDROID_KEYSTORE_B64` | `android staging_build` | Base64 of the Play upload keystore |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | `android staging_build` | The keystore password, key alias and key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | `android staging` | The Play Console service account's JSON key (the contents, not a path) |
| `BUILD_NUMBER` | every build (optional) | The store build number |

Android uses Play App Signing: the keystore above is the upload key, and Google
holds the app signing key.

## Before the first upload

- Create the `com.quadedu.parent.staging` app in App Store Connect and in the Play Console.
- Run `match appstore` once from a trusted machine, without `readonly`, to create the profile.
- Play accepts API uploads only after one bundle has been uploaded by hand. Until the app's first release is published, it also accepts only `draft` releases, which is why the lane uploads drafts: promote each one to the testers in the Play Console.
- Without the developer accounts, the lanes cannot upload. CI's `parent-build` job still proves the Android build (spec 18, M0b).
