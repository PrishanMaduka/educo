// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_membership_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInMembershipList _$SignInMembershipListFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SignInMembershipList', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = SignInMembershipList(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => SignInMembershipListItemsInner.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$SignInMembershipListToJson(
  SignInMembershipList instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
