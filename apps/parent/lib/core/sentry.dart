import 'package:flutter/foundation.dart';
import 'package:quad_parent/core/env.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// What the app tells Sentry. Built from the flavor's values, never from
/// anything a person typed.
@immutable
class SentryConfig {
  const new({
    required this.dsn,
    required this.environment,
    required this.sendDefaultPii,
    required this.tracesSampleRate,
  });

  final String dsn;
  final String environment;
  final bool sendDefaultPii;
  final double tracesSampleRate;
}

/// The Sentry setup for this build, or null when the flavor has no
/// `SENTRY_DSN`, in which case Sentry is not started at all.
SentryConfig? sentryOptionsFor(Env env) {
  if (env.sentryDsn.isEmpty) return null;
  return SentryConfig(
    dsn: env.sentryDsn,
    environment: env.appEnv.name,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  );
}

/// Applies [config] and Quad's privacy rules (D21, spec 16; the same rules as
/// the web apps' `SENTRY_DATA_COLLECTION` and `scrubSentryEvent`): no request
/// bodies, screenshots, view hierarchies, logs, print, tap or native
/// breadcrumbs, and no trace headers sent to other hosts. Every Dart event and
/// breadcrumb is scrubbed before it leaves the device.
void applySentryConfig(SentryFlutterOptions options, SentryConfig config) {
  options
    ..dsn = config.dsn
    ..environment = config.environment
    ..sendDefaultPii = config.sendDefaultPii
    ..tracesSampleRate = config.tracesSampleRate
    ..maxRequestBodySize = MaxRequestBodySize.never
    // attachViewHierarchy is off by default and is not set here because
    // the SDK marks it experimental. Replay is off while its sample rates
    // are unset.
    ..attachScreenshot = false
    ..enableLogs = false
    // Printed text can echo what people typed.
    ..enablePrintBreadcrumbs = false
    // Tap breadcrumbs carry widget labels, which can name a child.
    ..enableUserInteractionBreadcrumbs = false
    // Native breadcrumbs do not pass through beforeBreadcrumb.
    ..enableAutoNativeBreadcrumbs = false
    ..beforeSend = scrubSentryEvent
    ..beforeBreadcrumb = scrubBreadcrumb;
  options.tracePropagationTargets.clear();
}

/// The only request header kept: it says which app failed, not who.
const _keptHeader = 'user-agent';

/// Sentry's `beforeSend`. It:
/// - reduces the request to its URL (without query or fragment), method and
///   `user-agent` header, so the body, cookies, query and client address go;
/// - reduces the user to `{ id }`, or removes it when there is no id;
/// - drops the device's name (often the owner's name) and any response body;
/// - scrubs emails, phone numbers, credentials, query values and path tokens
///   from the message, exceptions, transaction, tags, extras and breadcrumbs.
SentryEvent? scrubSentryEvent(SentryEvent event, Hint hint) {
  final request = event.request;
  if (request != null) {
    event.request = SentryRequest(
      url: request.url == null ? null : scrubTelemetryUrl(request.url!),
      method: request.method,
      headers: {
        for (final MapEntry(:key, :value) in request.headers.entries)
          if (key.toLowerCase() == _keptHeader) key: value,
      },
    );
  }
  final userId = event.user?.id;
  event.user = userId == null ? null : SentryUser(id: userId);
  event.contexts.device?.name = null;
  event.contexts.response = null;

  final message = event.message;
  if (message != null) {
    event.message = SentryMessage(
      scrubTelemetryText(message.formatted),
      template: message.template == null
          ? null
          : scrubTelemetryText(message.template!),
    );
  }
  for (final exception in event.exceptions ?? const <SentryException>[]) {
    final value = exception.value;
    if (value != null) exception.value = scrubTelemetryText(value);
  }
  final transaction = event.transaction;
  if (transaction != null) event.transaction = scrubTelemetryUrl(transaction);
  final tags = event.tags;
  if (tags != null) {
    event.tags = tags.map((k, v) => MapEntry(k, scrubTelemetryText(v)));
  }
  // `extra` is deprecated, but the SDK still sends it, so it is scrubbed.
  // ignore: deprecated_member_use
  final extra = event.extra;
  // The same deprecated field, written back scrubbed.
  // ignore: deprecated_member_use
  if (extra != null) event.extra = _scrubMap(extra);
  final breadcrumbs = event.breadcrumbs;
  if (breadcrumbs != null) {
    event.breadcrumbs = [
      for (final crumb in breadcrumbs) ?scrubBreadcrumb(crumb, hint),
    ];
  }
  return event;
}

/// Sentry's `beforeBreadcrumb`: drops console breadcrumbs and scrubs the
/// message and data of the rest (URLs lose their query and fragment).
Breadcrumb? scrubBreadcrumb(Breadcrumb? breadcrumb, Hint hint) {
  if (breadcrumb == null || breadcrumb.category == 'console') return null;
  final message = breadcrumb.message;
  if (message != null) breadcrumb.message = scrubTelemetryText(message);
  final data = breadcrumb.data;
  if (data != null) {
    breadcrumb.data = {
      for (final MapEntry(:key, :value) in data.entries)
        key: key == 'url' && value is String
            ? scrubTelemetryUrl(value)
            : _scrubValue(value),
    };
  }
  return breadcrumb;
}

Map<String, dynamic> _scrubMap(Map<String, dynamic> map) => {
  for (final MapEntry(:key, :value) in map.entries) key: _scrubValue(value),
};

Object? _scrubValue(Object? value) => switch (value) {
  final String text => scrubTelemetryText(text),
  final List<Object?> list => [for (final item in list) _scrubValue(item)],
  final Map<String, dynamic> map => _scrubMap(map),
  _ => value,
};

// The same patterns as packages/contracts/src/observability/telemetry-scrub.ts;
// keep the two in step.
final _email = RegExp(
  r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}',
);
final _phoneInternational = RegExp(r'\+\d[\d\s().-]{6,18}\d');
final _phoneLkPrefixed = RegExp(
  r'\b(?:0094[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|94\d{9})\b',
);
final _phoneLocal = RegExp(r'\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b');
final _phoneLocalMobile = RegExp(r'\b7\d[\s-]\d{3}[\s-]\d{4}\b');
final _authScheme = RegExp(
  r'\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+',
  caseSensitive: false,
);
final _jwt = RegExp(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*');
final _queryValue = RegExp(r'''([?&][^=&\s#?]+=)[^&\s#"']*''');
final _sensitivePair = RegExp(
  r'''\b([A-Za-z0-9_.-]*(?:session|token|password|passwd|pwd|secret|code|key|auth|sig|otp|cookie)[A-Za-z0-9_.-]*)=(?!\[redacted\])[^\s;&,"'#]+''',
  caseSensitive: false,
);
final _pathToken = RegExp(
  r'''/(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{32,}(?=[/?#\s"']|$)''',
);
final _uuid = RegExp(
  r'^/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

/// The text with emails, phone numbers, credentials (auth schemes, JWTs,
/// sensitive `name=value` pairs), query values and path tokens replaced.
String scrubTelemetryText(String text) => text
    .replaceAll(_jwt, '[jwt]')
    .replaceAllMapped(_authScheme, (m) => '${m[1]} [redacted]')
    .replaceAllMapped(_queryValue, (m) => '${m[1]}[redacted]')
    .replaceAllMapped(_sensitivePair, (m) => '${m[1]}=[redacted]')
    .replaceAllMapped(
      _pathToken,
      (m) => _uuid.hasMatch(m[0]!) ? m[0]! : '/:token',
    )
    .replaceAll(_email, '[email]')
    .replaceAll(_phoneInternational, '[phone]')
    .replaceAll(_phoneLkPrefixed, '[phone]')
    .replaceAll(_phoneLocal, '[phone]')
    .replaceAll(_phoneLocalMobile, '[phone]');

/// A URL or path without its query string and fragment, then scrubbed.
String scrubTelemetryUrl(String url) {
  final end = url.indexOf(RegExp('[?#]'));
  return scrubTelemetryText(end == -1 ? url : url.substring(0, end));
}
