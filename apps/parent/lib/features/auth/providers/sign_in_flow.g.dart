// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_flow.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The phone, code and Found you steps (spec 05 Parent app steps 2 to 4).
/// Tokens are the [AuthController]'s; this keeps only what the screens show.

@ProviderFor(SignInFlow)
final signInFlowProvider = SignInFlowProvider._();

/// The phone, code and Found you steps (spec 05 Parent app steps 2 to 4).
/// Tokens are the [AuthController]'s; this keeps only what the screens show.
final class SignInFlowProvider
    extends $NotifierProvider<SignInFlow, SignInFlowState> {
  /// The phone, code and Found you steps (spec 05 Parent app steps 2 to 4).
  /// Tokens are the [AuthController]'s; this keeps only what the screens show.
  SignInFlowProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'signInFlowProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$signInFlowHash();

  @$internal
  @override
  SignInFlow create() => SignInFlow();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SignInFlowState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SignInFlowState>(value),
    );
  }
}

String _$signInFlowHash() => r'f3b8884153e87068097da58b7486169531983262';

/// The phone, code and Found you steps (spec 05 Parent app steps 2 to 4).
/// Tokens are the [AuthController]'s; this keeps only what the screens show.

abstract class _$SignInFlow extends $Notifier<SignInFlowState> {
  SignInFlowState build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<SignInFlowState, SignInFlowState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<SignInFlowState, SignInFlowState>,
              SignInFlowState,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
