//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:quad_api/src/model/sign_in_membership_list_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'sign_in_membership_list.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SignInMembershipList {
  /// Returns a new [SignInMembershipList] instance.
  SignInMembershipList({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<SignInMembershipListItemsInner> items;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInMembershipList &&
      other.items == items;

    @override
    int get hashCode =>
        items.hashCode;

  factory SignInMembershipList.fromJson(Map<String, dynamic> json) => _$SignInMembershipListFromJson(json);

  Map<String, dynamic> toJson() => _$SignInMembershipListToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

