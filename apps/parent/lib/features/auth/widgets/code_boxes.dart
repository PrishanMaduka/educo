import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// Six boxes for the sign-in code (spec 09 Start-up: auto-advance, paste and
/// SMS autofill). One text field sits over the boxes, so typing, pasting
/// "123 456" and the keyboard's one-time-code suggestion all fill it, and a
/// screen reader hears one field labelled [label].
class CodeBoxes extends StatefulWidget {
  const new({
    required this.controller,
    required this.label,
    required this.onCompleted,
    this.enabled = true,
    this.hasError = false,
    super.key,
  });

  static const length = 6;

  final TextEditingController controller;
  final String label;
  final ValueChanged<String> onCompleted;
  final bool enabled;
  final bool hasError;

  @override
  State<CodeBoxes> createState() => _CodeBoxesState();
}

class _CodeBoxesState extends State<CodeBoxes> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _focus.addListener(_changed);
  }

  @override
  void didUpdateWidget(CodeBoxes old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_changed);
      widget.controller.addListener(_changed);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  void _changed() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final code = widget.controller.text;
    final digitStyle = Theme.of(context).textTheme.headlineSmall;
    return Stack(
      children: [
        ExcludeSemantics(
          child: Row(
            children: [
              for (var i = 0; i < CodeBoxes.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 56),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(
                        QuadTokens.radiusInput,
                      ),
                      border: Border.all(
                        width: 1.5,
                        color: widget.hasError
                            ? c.bad
                            : _focus.hasFocus && i == code.length
                            ? c.brand
                            : c.lineStrong,
                      ),
                    ),
                    child: Text(
                      i < code.length ? code[i] : '',
                      style: digitStyle,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        Positioned.fill(
          child: Semantics(
            label: widget.label,
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              autofocus: true,
              enabled: widget.enabled,
              keyboardType: TextInputType.number,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(CodeBoxes.length),
              ],
              onChanged: (value) {
                if (value.length == CodeBoxes.length) widget.onCompleted(value);
              },
              showCursor: false,
              // The digits show in the boxes; the field's own text is hidden.
              style: const TextStyle(color: Colors.transparent),
              decoration: const InputDecoration.collapsed(hintText: null),
            ),
          ),
        ),
      ],
    );
  }
}
