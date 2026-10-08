import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Release signing and the store lanes cannot run in CI's Linux test job, so
/// these checks keep the files in line with the signing rule: credentials
/// come only from environment variables or fastlane match, never from git.
void main() {
  group('Android release signing', () {
    final gradle = File('android/app/build.gradle.kts').readAsStringSync();

    test('reads android/key.properties when it exists', () {
      expect(gradle, contains('rootProject.file("key.properties")'));
      expect(gradle, contains('create("release")'));
      for (final key in [
        'storeFile',
        'storePassword',
        'keyAlias',
        'keyPassword',
      ]) {
        expect(gradle, contains('keyProperties.getProperty("$key")'));
      }
    });

    test('falls back to the debug keys without it', () {
      expect(
        gradle,
        contains(
          'signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")',
        ),
      );
    });
  });

  test('signing files and Firebase configs are git-ignored', () {
    final ignored = File('.gitignore').readAsLinesSync().toSet();
    expect(
      ignored,
      containsAll([
        '/android/key.properties',
        '*.jks',
        '*.keystore',
        '*.p8',
        '/android/app/src/*/google-services.json',
        '/ios/config/*/GoogleService-Info.plist',
        '/fastlane/report.xml',
        '/fastlane/*.ipa',
        '/vendor/bundle/',
        '/.bundle/',
      ]),
    );
  });

  group('fastlane', () {
    final fastfile = File('fastlane/Fastfile').readAsStringSync();

    test('uploads staging to TestFlight and the Play internal track', () {
      expect(fastfile, contains('upload_to_testflight('));
      expect(fastfile, contains('track: "internal"'));
      expect(fastfile, contains('package_name: "com.quadedu.parent.staging"'));
      expect(
        fastfile,
        contains('app_identifier: "com.quadedu.parent.staging"'),
      );
    });

    test('builds the staging flavor with its env file', () {
      for (final command in ['ipa', 'appbundle']) {
        expect(
          fastfile,
          contains(
            'flutter build $command --flavor staging --release '
            '--dart-define-from-file=env/staging.json',
          ),
        );
      }
    });

    test('reads match read-only', () {
      expect(fastfile, contains('readonly: true'));
    });

    test(
      'names the missing match profile instead of failing on a KeyError',
      () {
        expect(fastfile, isNot(contains('ENV.fetch("sigh_')));
        expect(fastfile, contains('UI.user_error!("match did not export'));
      },
    );

    test('pins fastlane', () {
      expect(
        File('Gemfile').readAsStringSync(),
        contains('gem "fastlane", "2.240.1"'),
      );
    });
  });
}
