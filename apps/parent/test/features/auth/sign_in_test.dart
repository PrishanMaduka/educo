import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:quad_parent/features/auth/screens/code_screen.dart';
import 'package:quad_parent/features/auth/screens/face_id_offer_screen.dart';
import 'package:quad_parent/features/auth/screens/found_you_screen.dart';
import 'package:quad_parent/features/auth/screens/phone_screen.dart';
import 'package:quad_parent/features/auth/screens/school_picker_screen.dart';
import 'package:quad_parent/features/auth/screens/welcome_screen.dart';
import 'package:quad_parent/features/home/screens/home_screen.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/tokens.g.dart';

import '../../helpers/auth_fakes.dart';
import '../../helpers/pump_app.dart';
import '../../helpers/sign_in_data.dart';

final AppLocalizations l10n = lookupAppLocalizations(const Locale('en'));

/// The device clock of the last [openWelcome]; tests move it by hand.
late FakeClock clock;

/// A signed-out device on Welcome, answering from [routes].
Future<(FakeApi, MemorySecureStore)> openWelcome(
  WidgetTester tester, {
  Map<String, FakeRoute> routes = const {},
  FakeLocalAuth? localAuth,
}) async {
  final api = FakeApi(signInRoutes(routes));
  final store = MemorySecureStore();
  clock = FakeClock(mondayMorning);
  await tester.pumpWidget(
    appWith(clock: clock, store: store, api: api, localAuth: localAuth),
  );
  await tester.pumpAndSettle();
  return (api, store);
}

Future<void> tapText(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text));
  await tester.pump();
  await tester.tap(find.text(text));
}

/// Welcome → phone → Send code with [number].
Future<void> sendCode(
  WidgetTester tester, [
  String number = '77 000 0001',
]) async {
  await tapText(tester, l10n.parentWelcomeSignIn);
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField), number);
  await tapText(tester, l10n.parentSignInSendCode);
  await tester.pumpAndSettle();
}

/// The code step with [code] typed (or pasted) into the boxes.
Future<void> enterCode(WidgetTester tester, [String code = '000000']) async {
  await tester.enterText(find.byType(TextField), code);
  await tester.pumpAndSettle();
}

void main() {
  group('Welcome', () {
    testWidgets('is Quad-branded, with Sign in and the invite code', (
      tester,
    ) async {
      await openWelcome(tester);

      expect(find.text(l10n.parentWelcomeTitle), findsOneWidget);
      expect(find.text(l10n.parentWelcomeSubtitle), findsOneWidget);
      expect(find.text(l10n.parentWelcomeBrandNote), findsOneWidget);
      expect(
        find.bySemanticsLabel('Hear the good stuff first.'),
        findsOneWidget,
      );
    });

    testWidgets('says invite codes arrive soon', (tester) async {
      await openWelcome(tester);

      await tapText(tester, l10n.parentWelcomeInvite);
      await tester.pump();

      expect(find.text(l10n.parentWelcomeInviteSoon), findsOneWidget);
      expect(find.byType(WelcomeScreen), findsOneWidget);
    });
  });

  group('Phone', () {
    testWidgets('sends the code to the number with +94 and opens the code', (
      tester,
    ) async {
      final (api, _) = await openWelcome(tester);

      await sendCode(tester);

      final request = api.to('POST /api/v1/auth/otp/request').single;
      expect(bodyOf(request), {'phone': '+94 77 000 0001'});
      expect(bearerOf(request), isNull);
      expect(find.byType(CodeScreen), findsOneWidget);
      expect(
        find.text(l10n.parentSignInCodeSentTo('+94 •• ••• 0001')),
        findsOneWidget,
      );
    });

    testWidgets('sends to an email instead', (tester) async {
      final (api, _) = await openWelcome(tester);
      await tapText(tester, l10n.parentWelcomeSignIn);
      await tester.pumpAndSettle();

      await tapText(tester, l10n.parentSignInUseEmail);
      await tester.pumpAndSettle();
      expect(find.text(l10n.parentSignInEmailTitle), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'priya@example.com');
      await tapText(tester, l10n.parentSignInSendCode);
      await tester.pumpAndSettle();

      expect(bodyOf(api.to('POST /api/v1/auth/otp/request').single), {
        'email': 'priya@example.com',
      });
      expect(
        find.text(l10n.parentSignInCodeSentTo('priya@example.com')),
        findsOneWidget,
      );
    });

    testWidgets('shows how to type the number when the API refuses it', (
      tester,
    ) async {
      await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/request': (_) =>
              error(400, 'validation', {'phone': 'Enter a Sri Lankan number'}),
        },
      );

      await sendCode(tester, '12');

      expect(find.byType(PhoneScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInErrorPhone), findsOneWidget);
    });

    testWidgets('says when too many codes were asked for', (tester) async {
      await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/request': (_) => error(429, 'rate_limited'),
        },
      );

      await sendCode(tester);

      expect(find.text(l10n.parentSignInErrorTooMany), findsOneWidget);
    });

    testWidgets('says when the API cannot be reached', (tester) async {
      await openWelcome(
        tester,
        routes: {'POST /api/v1/auth/otp/request': (_) => const FakeReply(0)},
      );

      await sendCode(tester);

      expect(find.text(l10n.parentSignInErrorOffline), findsOneWidget);
    });

    testWidgets('shows a spinner while the code is on its way', (tester) async {
      final answer = Completer<FakeReply>();
      await openWelcome(
        tester,
        routes: {'POST /api/v1/auth/otp/request': (_) => answer.future},
      );
      await tapText(tester, l10n.parentWelcomeSignIn);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '77 000 0001');

      await tapText(tester, l10n.parentSignInSendCode);
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      answer.complete(const FakeReply(202));
      await tester.pumpAndSettle();
      expect(find.byType(CodeScreen), findsOneWidget);
    });
  });

  group('Code', () {
    testWidgets('signs in with the code and says "Found you"', (tester) async {
      final (api, store) = await openWelcome(tester);
      await sendCode(tester);

      await enterCode(tester);

      expect(bodyOf(api.to('POST /api/v1/auth/otp/verify').single), {
        'phone': '+94 77 000 0001',
        'code': '000000',
      });
      expect(store.values[SecureKey.refreshToken], 'r1');
      expect(find.byType(FoundYouScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInFoundTitle), findsOneWidget);
      expect(find.text(l10n.parentSignInFoundWelcome('Priya')), findsOneWidget);
      expect(find.text(greenfield.name), findsOneWidget);
      expect(bearerOf(api.to('GET /api/v1/me').last), 'Bearer a1');
    });

    testWidgets('a pasted code with a space still counts', (tester) async {
      final (api, _) = await openWelcome(tester);
      await sendCode(tester);

      await enterCode(tester, '000 000');

      expect(
        bodyOf(api.to('POST /api/v1/auth/otp/verify').single)['code'],
        '000000',
      );
    });

    testWidgets('a wrong code says so and empties the boxes', (tester) async {
      await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/verify': (_) => error(400, 'invalid_code'),
        },
      );
      await sendCode(tester);

      await enterCode(tester, '123456');

      expect(find.byType(CodeScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInCodeWrong), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller?.text,
        isEmpty,
      );
    });

    testWidgets('too many tries says to wait', (tester) async {
      await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/verify': (_) => error(403, 'account_locked'),
        },
      );
      await sendCode(tester);

      await enterCode(tester, '123456');

      expect(find.text(l10n.parentSignInCodeLocked), findsOneWidget);
    });

    testWidgets('offers a new code after 30 s and the hint after 60 s', (
      tester,
    ) async {
      final (api, _) = await openWelcome(tester);
      await sendCode(tester);

      expect(find.text(l10n.parentSignInCodeResendIn('0:30')), findsOneWidget);
      expect(find.text(l10n.parentSignInCodeResend), findsNothing);
      clock.advance(const Duration(seconds: 29));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(l10n.parentSignInCodeResendIn('0:01')), findsOneWidget);
      clock.advance(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(l10n.parentSignInCodeResend), findsOneWidget);
      expect(find.text(l10n.parentSignInCodeNoCode), findsNothing);

      clock.advance(const Duration(seconds: 30));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(l10n.parentSignInCodeNoCode), findsOneWidget);

      await tapText(tester, l10n.parentSignInCodeResend);
      await tester.pumpAndSettle();
      expect(api.to('POST /api/v1/auth/otp/request'), hasLength(2));
      expect(find.text(l10n.parentSignInCodeResent), findsOneWidget);
      expect(find.text(l10n.parentSignInCodeResendIn('0:30')), findsOneWidget);
    });

    testWidgets('counts from when the code was sent, not timer ticks', (
      tester,
    ) async {
      await openWelcome(tester);
      await sendCode(tester);

      // Away in the SMS app: timers do not run in the background.
      clock.advance(const Duration(seconds: 31));
      await tester.pump(const Duration(seconds: 1));

      expect(find.text(l10n.parentSignInCodeResend), findsOneWidget);
    });

    testWidgets('several schools open the school picker', (tester) async {
      await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/verify': (_) => FakeReply(
            200,
            chooseSchoolJson([
              membershipJson(greenfield),
              membershipJson(riverside),
            ]),
          ),
        },
      );
      await sendCode(tester);

      await enterCode(tester);

      expect(find.byType(SchoolPickerScreen), findsOneWidget);
      expect(
        find.text(l10n.parentSignInSchoolIntroNamed('Priya')),
        findsOneWidget,
      );
      expect(find.text(greenfield.name), findsOneWidget);
      expect(find.text(riverside.name), findsOneWidget);
    });

    testWidgets('no school says "We couldn\'t find you"', (tester) async {
      final (_, store) = await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/verify': (_) =>
              const FakeReply(200, notFoundJson),
        },
      );
      await sendCode(tester);

      await enterCode(tester);

      expect(find.text(l10n.parentSignInNotFoundTitle), findsOneWidget);
      expect(find.text(l10n.parentSignInNotFoundBody), findsOneWidget);
      expect(store.values, isEmpty);

      await tapText(tester, l10n.parentSignInNotFoundTryAgain);
      await tester.pumpAndSettle();
      expect(find.byType(PhoneScreen), findsOneWidget);
    });
  });

  group('Found you', () {
    testWidgets("wears the school's brand; the steps before are Quad's", (
      tester,
    ) async {
      await openWelcome(tester);
      QuadColors colours<T extends Widget>() =>
          Theme.of(tester.element(find.byType(T))).extension<QuadColors>()!;
      expect(colours<WelcomeScreen>().brandFill, QuadColors.light.brandFill);
      await sendCode(tester);

      await enterCode(tester);

      expect(colours<FoundYouScreen>().brandFill, const Color(0xFF1B7F53));
    });

    testWidgets('waits for the school, then shows it', (tester) async {
      final me = Completer<FakeReply>();
      await openWelcome(tester, routes: {'GET /api/v1/me': (_) => me.future});
      await sendCode(tester);

      await tester.enterText(find.byType(TextField), '000000');
      await tester.pump();
      await tester.pump();

      expect(find.text(l10n.parentSignInFoundLoading), findsOneWidget);
      me.complete(FakeReply(200, meJson()));
      await tester.pumpAndSettle();
      expect(find.text(l10n.parentSignInFoundTitle), findsOneWidget);
    });

    testWidgets('offers Try again when the school cannot load', (tester) async {
      var calls = 0;
      await openWelcome(
        tester,
        routes: {
          'GET /api/v1/me': (_) =>
              ++calls == 1 ? const FakeReply(500) : FakeReply(200, meJson()),
        },
      );
      await sendCode(tester);
      await enterCode(tester);

      expect(find.text(l10n.parentSignInFoundLoadFailed), findsOneWidget);
      await tapText(tester, l10n.parentSignInRetry);
      await tester.pumpAndSettle();

      expect(find.text(l10n.parentSignInFoundTitle), findsOneWidget);
    });

    testWidgets('goes on to the Face ID offer', (tester) async {
      await openWelcome(tester);
      await sendCode(tester);
      await enterCode(tester);

      await tapText(tester, l10n.parentSignInFoundContinue);
      await tester.pumpAndSettle();

      expect(find.byType(FaceIdOfferScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInFaceTitle), findsOneWidget);
    });

    testWidgets('goes straight Home on a device with no biometrics', (
      tester,
    ) async {
      await openWelcome(tester, localAuth: FakeLocalAuth(biometrics: []));
      await sendCode(tester);
      await enterCode(tester);

      await tapText(tester, l10n.parentSignInFoundContinue);
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInDone), findsOneWidget);
    });
  });

  group('School picker', () {
    Future<FakeApi> openPicker(
      WidgetTester tester,
      List<Map<String, Object?>> schools, {
      Map<String, FakeRoute> routes = const {},
    }) async {
      var chosen = greenfield;
      final (api, _) = await openWelcome(
        tester,
        routes: {
          'POST /api/v1/auth/otp/verify': (_) =>
              FakeReply(200, chooseSchoolJson(schools)),
          'POST /api/v1/auth/select-school': (request) {
            chosen = bodyOf(request)['tenantId'] == riverside.id
                ? riverside
                : greenfield;
            return const FakeReply(200, {
              'accessToken': 'school',
              'refreshToken': 'r2',
            });
          },
          'GET /api/v1/me': (_) => FakeReply(200, meJson(school: chosen)),
          ...routes,
        },
      );
      await sendCode(tester);
      await enterCode(tester);
      return api;
    }

    testWidgets('opens the chosen school with the select token', (
      tester,
    ) async {
      final api = await openPicker(tester, [
        membershipJson(greenfield),
        membershipJson(riverside),
      ]);

      await tapText(tester, riverside.name);
      await tester.pumpAndSettle();

      final request = api.to('POST /api/v1/auth/select-school').single;
      expect(bodyOf(request)['tenantId'], riverside.id);
      expect(bearerOf(request), 'Bearer select');
      expect(find.byType(FoundYouScreen), findsOneWidget);
    });

    testWidgets("never shows another school's answer as the chosen one", (
      tester,
    ) async {
      await openPicker(
        tester,
        [membershipJson(greenfield), membershipJson(riverside)],
        routes: {'GET /api/v1/me': (_) => FakeReply(200, meJson())},
      );

      await tapText(tester, riverside.name);
      await tester.pumpAndSettle();

      expect(find.text(greenfield.name), findsNothing);
      expect(find.text(l10n.parentSignInFoundLoadFailed), findsOneWidget);
    });

    testWidgets('lists a paused school but cannot open it', (tester) async {
      final api = await openPicker(tester, [
        membershipJson(greenfield),
        membershipJson(
          riverside,
          suspended: true,
          suspendReason: 'Closed for the holidays',
        ),
      ]);

      expect(find.text('Closed for the holidays'), findsOneWidget);
      await tapText(tester, riverside.name);
      await tester.pumpAndSettle();

      expect(api.to('POST /api/v1/auth/select-school'), isEmpty);
      expect(find.byType(SchoolPickerScreen), findsOneWidget);
    });

    testWidgets('a choice after 5 minutes asks to sign in again', (
      tester,
    ) async {
      await openPicker(
        tester,
        [membershipJson(greenfield), membershipJson(riverside)],
        routes: {
          'POST /api/v1/auth/select-school': (_) => error(401, 'unauthorized'),
        },
      );

      await tapText(tester, greenfield.name);
      await tester.pumpAndSettle();

      expect(find.text(l10n.parentSignInSchoolExpired), findsOneWidget);
    });

    testWidgets('says when the school could not be opened', (tester) async {
      await openPicker(
        tester,
        [membershipJson(greenfield), membershipJson(riverside)],
        routes: {
          'POST /api/v1/auth/select-school': (_) => const FakeReply(500),
        },
      );

      await tapText(tester, greenfield.name);
      await tester.pumpAndSettle();

      expect(find.text(l10n.parentSignInSchoolFailed), findsOneWidget);
    });

    testWidgets('with no school to open, says so', (tester) async {
      await openPicker(tester, []);

      expect(find.text(l10n.parentSignInSchoolNone), findsOneWidget);
    });
  });

  group('Face ID offer', () {
    Future<MemorySecureStore> openOffer(
      WidgetTester tester, {
      List<BiometricType> biometrics = const [BiometricType.face],
    }) async {
      final (_, store) = await openWelcome(
        tester,
        localAuth: FakeLocalAuth(biometrics: biometrics),
      );
      await sendCode(tester);
      await enterCode(tester);
      await tapText(tester, l10n.parentSignInFoundContinue);
      await tester.pumpAndSettle();
      return store;
    }

    testWidgets('Turn on Face ID stores the choice and opens Home', (
      tester,
    ) async {
      final store = await openOffer(tester);

      await tapText(tester, l10n.parentSignInFaceTurnOn);
      await tester.pumpAndSettle();

      expect(store.values[SecureKey.biometricsOn], 'true');
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInFaceOn), findsOneWidget);
    });

    testWidgets('Not now leaves it off (it starts off, D51)', (tester) async {
      final store = await openOffer(tester);

      await tapText(tester, l10n.parentSignInFaceNotNow);
      await tester.pumpAndSettle();

      expect(store.values.containsKey(SecureKey.biometricsOn), isFalse);
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.text(l10n.parentSignInDone), findsOneWidget);
    });

    testWidgets('speaks of the fingerprint on a fingerprint device', (
      tester,
    ) async {
      await openOffer(tester, biometrics: [BiometricType.strong]);

      expect(find.text(l10n.parentSignInFingerprintTitle), findsOneWidget);
      expect(find.text(l10n.parentSignInFingerprintTurnOn), findsOneWidget);
    });
  });
}
