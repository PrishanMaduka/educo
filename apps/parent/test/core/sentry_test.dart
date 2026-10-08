import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/core/env.dart';
import 'package:quad_parent/core/sentry.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Env _env({String appEnv = 'staging', String dsn = ''}) => Env.fromJson({
  'APP_ENV': appEnv,
  'API_URL': 'https://staging.quad-edu.com/api/v1',
  'SOCKET_URL': 'wss://staging.quad-edu.com',
  'SENTRY_DSN': dsn,
});

const _dsn = 'https://public@o0.ingest.sentry.io/0';

void main() {
  group('sentryOptionsFor', () {
    test('is null when the flavor has no DSN, so Sentry stays off', () {
      expect(sentryOptionsFor(_env()), isNull);
    });

    test('reports to the APP_ENV environment without personal data', () {
      final config = sentryOptionsFor(_env(dsn: _dsn))!;
      expect(config.dsn, _dsn);
      expect(config.environment, 'staging');
      expect(config.sendDefaultPii, isFalse);
      // Mobile tracing is off for M0b, as on the web (D28).
      expect(config.tracesSampleRate, 0);
    });

    test('names production as production', () {
      final config = sentryOptionsFor(_env(appEnv: 'production', dsn: _dsn));
      expect(config!.environment, 'production');
    });
  });

  group('applySentryConfig', () {
    final options = SentryFlutterOptions();
    applySentryConfig(options, sentryOptionsFor(_env(dsn: _dsn))!);

    test('sets the DSN, environment and sample rate', () {
      expect(options.dsn, _dsn);
      expect(options.environment, 'staging');
      expect(options.tracesSampleRate, 0);
    });

    test('does not trace taps, whose labels can name a child', () {
      expect(options.enableUserInteractionTracing, isFalse);
    });

    test('collects no personal data, bodies, screenshots or logs', () {
      expect(options.sendDefaultPii, isFalse);
      expect(options.maxRequestBodySize, MaxRequestBodySize.never);
      expect(options.attachScreenshot, isFalse);
      expect(options.enableLogs, isFalse);
      expect(options.enablePrintBreadcrumbs, isFalse);
      expect(options.enableUserInteractionBreadcrumbs, isFalse);
      expect(options.enableAutoNativeBreadcrumbs, isFalse);
      expect(options.tracePropagationTargets, isEmpty);
    });

    test('scrubs every event, transaction and breadcrumb', () {
      expect(options.beforeSend, isNotNull);
      expect(options.beforeSendTransaction, isNotNull);
      expect(options.beforeBreadcrumb, isNotNull);
    });
  });

  group('the cases shared with packages/contracts', () {
    final cases = jsonDecode(
      File(
        '../../packages/contracts/src/observability/'
        'telemetry-scrub.cases.json',
      ).readAsStringSync(),
    ) as Map<String, dynamic>;

    for (final pair in cases['scrubbed'] as List<dynamic>) {
      final [input as String, expected as String] = pair as List<dynamic>;
      test('scrubs ${jsonEncode(input)}', () {
        expect(scrubTelemetryText(input), expected);
      });
    }
    for (final input in (cases['unchanged'] as List<dynamic>).cast<String>()) {
      test('leaves ${jsonEncode(input)} alone', () {
        expect(scrubTelemetryText(input), input);
      });
    }
    for (final pair in cases['urls'] as List<dynamic>) {
      final [input as String, expected as String] = pair as List<dynamic>;
      test('turns the URL ${jsonEncode(input)} into $expected', () {
        expect(scrubTelemetryUrl(input), expected);
      });
    }
  });

  group('scrubSentryTransaction', () {
    test(
      'scrubs the name, span descriptions and data, and the event',
      () async {
        SentryTransaction? sent;
        final options = SentryFlutterOptions(dsn: _dsn)
          ..tracesSampleRate = 1
          ..beforeSendTransaction = (transaction, hint) {
            sent = scrubSentryTransaction(transaction, hint);
            // Captured for the test; nothing is sent.
            return null;
          };
        final hub = Hub(options)
          ..configureScope(
            (scope) => scope.setUser(SentryUser(id: 'u1', email: 'a@b.co')),
          );
        final transaction = hub.startTransaction(
          '/p/pass/k8Jq2xYz09AbCdEfGhIjKlMnOpQrStUvWx1?phone=1',
          'ui.load',
          bindToScope: false,
        );
        final span = transaction.startChild(
          'http.client',
          description: 'GET https://staging.quad-edu.com/api/v1/x?phone=1',
        )..setData('who', 'dilhani@example.com');
        await span.finish();
        await transaction.finish();

        expect(sent, isNotNull);
        expect(sent!.transaction, '/p/pass/:token');
        final child = sent!.spans.singleWhere(
          (s) => s.context.operation == 'http.client',
        );
        expect(
          child.context.description,
          'GET https://staging.quad-edu.com/api/v1/x?phone=[redacted]',
        );
        expect(child.data['who'], '[email]');
        expect(sent!.user?.toJson(), {'id': 'u1'});
      },
    );
  });

  group('scrubTelemetryText', () {
    test('replaces emails and phone numbers', () {
      expect(
        scrubTelemetryText('dilhani@example.com called +94 77 000 0001'),
        '[email] called [phone]',
      );
      expect(scrubTelemetryText('call 077 000 0001'), 'call [phone]');
      expect(scrubTelemetryText('call 0094 77 000 0001'), 'call [phone]');
      expect(scrubTelemetryText('call 77 000 0001'), 'call [phone]');
    });

    test('replaces credentials and query values', () {
      expect(
        scrubTelemetryText('Authorization: Bearer abc.def'),
        'Authorization: Bearer [redacted]',
      );
      expect(scrubTelemetryText('t=eyJhbGc.eyJzdWI.sig'), 't=[jwt]');
      expect(
        scrubTelemetryText('/family/home?child=1&otp=123456'),
        '/family/home?child=[redacted]&otp=[redacted]',
      );
      expect(
        scrubTelemetryText('otp_code=123456 left'),
        'otp_code=[redacted] left',
      );
    });

    test('replaces opaque path tokens but keeps UUIDs', () {
      expect(
        scrubTelemetryText('/p/pass/abcdefghijklmnopqrstuvwxyz0123456789'),
        '/p/pass/:token',
      );
      const uuid = '/students/0190a0e4-1c2b-7d3e-8f40-123456789abc';
      expect(scrubTelemetryText(uuid), uuid);
    });
  });

  group('scrubSentryEvent', () {
    test('keeps only the request URL path, method and user-agent', () {
      final event = SentryEvent(
        request: SentryRequest(
          url: 'https://staging.quad-edu.com/api/v1/auth/otp?phone=1#x',
          method: 'POST',
          queryString: 'phone=+94770000001',
          cookies: 'quad_session=abc',
          data: {'phone': '+94 77 000 0001'},
          headers: {'User-Agent': 'Quad/0.1', 'Authorization': 'Bearer x'},
          env: {'REMOTE_ADDR': '10.0.0.1'},
        ),
      );
      final request = scrubSentryEvent(event, Hint())!.request!;
      expect(request.url, 'https://staging.quad-edu.com/api/v1/auth/otp');
      expect(request.method, 'POST');
      expect(request.queryString, isNull);
      expect(request.cookies, isNull);
      expect(request.data, isNull);
      expect(request.headers, {'User-Agent': 'Quad/0.1'});
      expect(request.env, isEmpty);
    });

    test('reduces the user to an id, or removes it without one', () {
      final withId = scrubSentryEvent(
        SentryEvent(
          user: SentryUser(
            id: 'u1',
            email: 'a@b.co',
            name: 'Dilhani',
            ipAddress: '1.2.3.4',
          ),
        ),
        Hint(),
      )!;
      expect(withId.user!.toJson(), {'id': 'u1'});
      final withoutId = scrubSentryEvent(
        SentryEvent(user: SentryUser(email: 'a@b.co')),
        Hint(),
      )!;
      expect(withoutId.user, isNull);
    });

    test('scrubs messages, exceptions, tags, extras and breadcrumbs', () {
      final event = SentryEvent(
        message: SentryMessage('No account for dilhani@example.com'),
        exceptions: [
          SentryException(type: 'StateError', value: 'phone +94 77 000 0001'),
        ],
        tags: {'who': 'a@b.co'},
        // Deprecated, but still sent by the SDK, so it must be scrubbed.
        // ignore: deprecated_member_use
        extra: {
          'nested': ['077 000 0001'],
        },
        breadcrumbs: [Breadcrumb(message: 'signed in as a@b.co')],
        transaction: '/p/pass/abcdefghijklmnopqrstuvwxyz0123456789',
      );
      final scrubbed = scrubSentryEvent(event, Hint())!;
      expect(scrubbed.message!.formatted, 'No account for [email]');
      expect(scrubbed.exceptions!.single.value, 'phone [phone]');
      expect(scrubbed.tags, {'who': '[email]'});
      // The deprecated field again, read back.
      // ignore: deprecated_member_use
      expect(scrubbed.extra, {
        'nested': ['[phone]'],
      });
      expect(scrubbed.breadcrumbs!.single.message, 'signed in as [email]');
      expect(scrubbed.transaction, '/p/pass/:token');
    });

    test("drops the device's name, which is often the owner's name", () {
      final event = SentryEvent(
        contexts: Contexts(device: SentryDevice(name: "Dilhani's iPhone")),
      );
      expect(scrubSentryEvent(event, Hint())!.contexts.device!.name, isNull);
    });
  });

  group('scrubBreadcrumb', () {
    test('drops console breadcrumbs, which can echo what people typed', () {
      expect(
        scrubBreadcrumb(
          Breadcrumb.console(message: 'typed 0770000001'),
          Hint(),
        ),
        isNull,
      );
    });

    test('scrubs the message and data, and strips the query from URLs', () {
      final crumb = scrubBreadcrumb(
        Breadcrumb.http(
          url: Uri.parse('https://staging.quad-edu.com/api/v1/x?phone=1'),
          method: 'GET',
        ),
        Hint(),
      )!;
      expect(crumb.data!['url'], 'https://staging.quad-edu.com/api/v1/x');
      final note = scrubBreadcrumb(
        Breadcrumb(message: 'hi a@b.co', data: {'to': '+94 77 000 0001'}),
        Hint(),
      )!;
      expect(note.message, 'hi [email]');
      expect(note.data, {'to': '[phone]'});
    });

    test('passes null through', () {
      expect(scrubBreadcrumb(null, Hint()), isNull);
    });
  });
}
