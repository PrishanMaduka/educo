import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The native flavor setup cannot be built in CI's Linux test job, so these
/// checks keep the Gradle and Xcode files in line with spec 09 and env/.
void main() {
  const flavors = {
    'dev': ('com.quadedu.parent.dev', 'Quad DEV'),
    'staging': ('com.quadedu.parent.staging', 'Quad STG'),
    'prod': ('com.quadedu.parent', 'Quad – School & Family'),
  };
  final gradle = File('android/app/build.gradle.kts').readAsStringSync();

  test('Android uses com.quadedu.parent as the base application id', () {
    expect(gradle, contains('applicationId = "com.quadedu.parent"'));
    expect(gradle, contains('namespace = "com.quadedu.parent"'));
  });

  for (final MapEntry(key: flavor, value: (bundleId, name))
      in flavors.entries) {
    group(flavor, () {
      test('has an env file', () {
        expect(File('env/$flavor.json').existsSync(), isTrue);
      });

      test('is an Android product flavor with its id and name', () {
        final block = RegExp(
          'create\\("$flavor"\\) \\{(.*?)\\n        \\}',
          dotAll: true,
        ).firstMatch(gradle)?.group(1);
        expect(block, isNotNull);
        final suffix = bundleId.substring('com.quadedu.parent'.length);
        if (suffix.isEmpty) {
          expect(block, isNot(contains('applicationIdSuffix')));
        } else {
          expect(block, contains('applicationIdSuffix = "$suffix"'));
        }
        expect(block, contains('resValue("string", "app_name", "$name")'));
      });

      for (final mode in ['Debug', 'Release', 'Profile']) {
        test('has an iOS $mode-$flavor xcconfig with its id and name', () {
          final config = File('ios/Flutter/$mode-$flavor.xcconfig')
              .readAsStringSync();
          expect(config, contains('PRODUCT_BUNDLE_IDENTIFIER = $bundleId\n'));
          expect(config, contains('APP_DISPLAY_NAME = $name\n'));
        });
      }

      test('has a shared iOS scheme that uses its configurations', () {
        final scheme = File(
          'ios/Runner.xcodeproj/xcshareddata/xcschemes/$flavor.xcscheme',
        ).readAsStringSync();
        final used = RegExp('buildConfiguration = "([^"]+)"')
            .allMatches(scheme)
            .map((m) => m.group(1))
            .toSet();
        expect(used, {'Debug-$flavor', 'Release-$flavor', 'Profile-$flavor'});
      });
    });
  }

  test('the Runner target takes its bundle id from the xcconfigs', () {
    final project = File('ios/Runner.xcodeproj/project.pbxproj')
        .readAsStringSync();
    expect(
      project,
      isNot(contains('PRODUCT_BUNDLE_IDENTIFIER = com.quadedu.parent;')),
    );
    for (final flavor in flavors.keys) {
      for (final mode in ['Debug', 'Release', 'Profile']) {
        expect(
          project,
          contains('/* $mode-$flavor.xcconfig */;'),
          reason: 'baseConfigurationReference of $mode-$flavor',
        );
      }
    }
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    expect(plist, contains(r'<string>$(APP_DISPLAY_NAME)</string>'));
  });
}
