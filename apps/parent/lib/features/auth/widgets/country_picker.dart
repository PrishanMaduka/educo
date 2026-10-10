import 'package:flutter/material.dart';
import 'package:quad_parent/features/auth/providers/sign_in_flow.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// The country code beside the mobile number ("LK +94"), from
/// [signInCountries].
class CountryPicker extends StatelessWidget {
  const new({
    required this.value,
    required this.label,
    required this.onChanged,
    super.key,
  });

  final SignInCountry value;
  final String label;
  final ValueChanged<SignInCountry> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      label: label,
      child: DropdownButtonFormField<SignInCountry>(
        initialValue: value,
        isExpanded: true,
        decoration: signInFieldDecoration(c),
        dropdownColor: c.surface,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: c.ink),
        items: [
          for (final country in signInCountries)
            DropdownMenuItem(
              value: country,
              child: Text('${country.iso} ${country.dialCode}'),
            ),
        ],
        onChanged: (country) {
          if (country != null) onChanged(country);
        },
      ),
    );
  }
}

/// The outlined field of the sign-in steps (design/parent.html `.input`).
InputDecoration signInFieldDecoration(QuadColors c, {String? label}) {
  OutlineInputBorder border(Color colour) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(QuadTokens.radiusInput),
    borderSide: BorderSide(color: colour, width: 1.5),
  );
  return InputDecoration(
    labelText: label,
    filled: true,
    fillColor: c.surface,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    // Control edges meet 3:1 (field-line); focus is always blue (D34).
    border: border(c.fieldLine),
    enabledBorder: border(c.fieldLine),
    focusedBorder: border(c.focus),
    errorBorder: border(c.bad),
    focusedErrorBorder: border(c.bad),
  );
}
