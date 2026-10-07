import 'package:flutter/material.dart';
import 'package:quad_parent/ui/quad_empty_state.dart';

/// A tab's page: a header, then a scrolling body (story first).
class TabPage extends StatelessWidget {
  const TabPage({required this.header, required this.children, super.key});

  final Widget header;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 14, 2, 12),
            child: header,
          ),
          ...children,
        ],
      ),
    );
  }
}

/// A placeholder tab: its title and one sentence on what will appear.
class PlaceholderTab extends StatelessWidget {
  const PlaceholderTab({required this.title, required this.message, super.key});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return TabPage(
      header: Semantics(
        header: true,
        child: Text(title, style: Theme.of(context).textTheme.headlineSmall),
      ),
      children: [QuadEmptyState(message: message)],
    );
  }
}
