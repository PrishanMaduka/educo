import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api_problem.dart';
import 'package:quad_parent/core/clock.dart';
import 'package:quad_parent/features/auth/providers/sign_in_flow.dart';
import 'package:quad_parent/features/auth/widgets/code_boxes.dart';
import 'package:quad_parent/features/auth/widgets/sign_in_frame.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// The code (spec 05 Parent app step 3): six boxes, "It works for 10
/// minutes", resend after 30 s, and after 60 s the hint to use the number
/// the school has on file (D39).
class CodeScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const resendAfter = Duration(seconds: 30);
  static const hintAfter = Duration(seconds: 60);

  @override
  ConsumerState<CodeScreen> createState() => _CodeScreenState();
}

class _CodeScreenState extends ConsumerState<CodeScreen> {
  final _code = TextEditingController();
  Timer? _timer;
  var _checking = false;
  var _resending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startClock();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  /// When the code was (last) sent. The time left is read from the clock,
  /// because timers stop while the app is in the background (the parent
  /// reading the SMS); the periodic timer only repaints.
  late DateTime _sentAt;

  Duration get _waited => ref.read(clockProvider)().difference(_sentAt);

  void _startClock() {
    _timer?.cancel();
    _sentAt = ref.read(clockProvider)();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {});
      if (_waited >= CodeScreen.hintAfter) timer.cancel();
    });
  }

  Future<void> _verify(String code) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      final result = await ref.read(signInFlowProvider.notifier).verify(code);
      if (!mounted) return;
      context.go(switch (result.status) {
        OtpVerifyResultStatusEnum.chooseSchool => '/sign-in/school',
        OtpVerifyResultStatusEnum.signedIn ||
        OtpVerifyResultStatusEnum.notFound => '/sign-in/found',
      });
    } on Object catch (error) {
      if (!mounted) return;
      _code.clear();
      setState(() {
        _checking = false;
        _error = switch (apiProblemOf(error)) {
          ApiProblem.invalidCode ||
          ApiProblem.validation => l10n.parentSignInCodeWrong,
          ApiProblem.rateLimited => l10n.parentSignInErrorTooMany,
          ApiProblem.locked => l10n.parentSignInCodeLocked,
          ApiProblem.offline => l10n.parentSignInErrorOffline,
          _ => l10n.parentSignInErrorGeneric,
        };
      });
    }
  }

  Future<void> _resend() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      await ref.read(signInFlowProvider.notifier).resend();
      if (!mounted) return;
      _code.clear();
      _startClock();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.parentSignInCodeResent)));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (apiProblemOf(error)) {
          ApiProblem.rateLimited => l10n.parentSignInErrorTooMany,
          ApiProblem.offline => l10n.parentSignInErrorOffline,
          _ => l10n.parentSignInErrorGeneric,
        };
      });
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final c = context.colors;
    final subject = ref.watch(signInFlowProvider).subject;
    final to = subject?.email ?? maskPhone(subject?.phone ?? '');
    final waited = _waited;
    final left = CodeScreen.resendAfter - waited;
    return SignInFrame(
      onBack: _checking
          ? null
          : () =>
                context.canPop() ? context.pop() : context.go('/sign-in/phone'),
      title: l10n.parentSignInCodeTitle,
      children: [
        Text(l10n.parentSignInCodeSentTo(to), style: text.bodyLarge),
        const SizedBox(height: 18),
        CodeBoxes(
          controller: _code,
          label: l10n.parentSignInCodeBoxes,
          enabled: !_checking,
          hasError: _error != null,
          onCompleted: _verify,
        ),
        SignInError(message: _error),
        const SizedBox(height: 16),
        if (_checking)
          Semantics(
            liveRegion: true,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    l10n.parentSignInCodeChecking,
                    style: text.bodyMedium,
                  ),
                ),
              ],
            ),
          )
        else if (left > Duration.zero)
          Text(
            l10n.parentSignInCodeResendIn(_clock(left)),
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(color: c.ink2),
          )
        else
          SignInLink(
            label: l10n.parentSignInCodeResend,
            onPressed: _resending ? null : _resend,
          ),
        if (!_checking && waited >= CodeScreen.hintAfter) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: c.surface2,
              borderRadius: BorderRadius.circular(QuadTokens.radiusInput),
            ),
            child: Text(
              l10n.parentSignInCodeNoCode,
              textAlign: TextAlign.center,
              style: text.bodyMedium,
            ),
          ),
        ],
      ],
    );
  }

  static String _clock(Duration left) {
    final seconds = (left.inMilliseconds / 1000).ceil();
    return '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
  }
}

/// "+94 77 000 0001" → "+94 •• ••• 0001": the last four digits stay, as on
/// the prototype's code step. The country code is kept as it is.
String maskPhone(String phone) {
  final space = phone.indexOf(' ');
  if (space < 0) return phone;
  final national = phone
      .substring(space + 1)
      .replaceAllMapped(RegExp(r'\d(?=(?:\D*\d){4})'), (_) => '•');
  return '${phone.substring(0, space)} $national';
}
