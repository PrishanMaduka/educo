import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/core/api_problem.dart';
import 'package:quad_parent/features/auth/providers/sign_in_flow.dart';
import 'package:quad_parent/features/auth/widgets/country_picker.dart';
import 'package:quad_parent/features/auth/widgets/sign_in_frame.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';

/// Phone or email (spec 05 Parent app step 2): **Send code**, and "Use email
/// instead". The API checks the number against the country list.
class PhoneScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final _field = TextEditingController();
  SignInCountry _country = signInCountries.first;
  var _useEmail = false;
  var _sending = false;
  String? _error;

  @override
  void dispose() {
    _field.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    final value = _field.text.trim();
    final subject = _useEmail
        ? SignInSubject.email(value)
        : SignInSubject.phone('${_country.dialCode} $value');
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(signInFlowProvider.notifier).requestCode(subject);
      if (!mounted) return;
      setState(() => _sending = false);
      await context.push('/sign-in/code');
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = switch (apiProblemOf(error)) {
          ApiProblem.validation =>
            _useEmail
                ? l10n.parentSignInErrorEmail
                : l10n.parentSignInErrorPhone,
          ApiProblem.rateLimited => l10n.parentSignInErrorTooMany,
          ApiProblem.offline => l10n.parentSignInErrorOffline,
          _ => l10n.parentSignInErrorGeneric,
        };
      });
    }
  }

  void _switchMode() => setState(() {
    _useEmail = !_useEmail;
    _error = null;
    _field.clear();
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = context.colors;
    final field = TextField(
      controller: _field,
      enabled: !_sending,
      autofocus: true,
      keyboardType: _useEmail
          ? TextInputType.emailAddress
          : TextInputType.phone,
      autofillHints: [
        if (_useEmail)
          AutofillHints.email
        else
          AutofillHints.telephoneNumberNational,
      ],
      textInputAction: TextInputAction.send,
      onSubmitted: (_) => _send(),
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: c.ink),
      decoration: signInFieldDecoration(
        c,
        label: _useEmail
            ? l10n.parentSignInEmailAddress
            : l10n.parentSignInMobile,
      ),
    );
    return SignInFrame(
      onBack: () => context.canPop() ? context.pop() : context.go('/welcome'),
      title: _useEmail
          ? l10n.parentSignInEmailTitle
          : l10n.parentSignInPhoneTitle,
      children: [
        Text(
          _useEmail ? l10n.parentSignInEmailIntro : l10n.parentSignInPhoneIntro,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 18),
        if (_useEmail)
          field
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 120,
                child: CountryPicker(
                  value: _country,
                  label: l10n.parentSignInCountryCode,
                  onChanged: (country) => setState(() => _country = country),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(child: field),
            ],
          ),
        SignInError(message: _error),
        const SizedBox(height: 16),
        SignInButton(
          label: l10n.parentSignInSendCode,
          busy: _sending,
          onPressed: _send,
        ),
        const SizedBox(height: 6),
        SignInLink(
          label: _useEmail
              ? l10n.parentSignInUsePhone
              : l10n.parentSignInUseEmail,
          onPressed: _sending ? null : _switchMode,
        ),
      ],
    );
  }
}
