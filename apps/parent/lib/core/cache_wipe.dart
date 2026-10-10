import 'package:flutter/painting.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'cache_wipe.g.dart';

/// Clears what the app keeps on the device outside secure storage (spec 09
/// Cache security). Today that is the image cache; the encrypted drift
/// database joins it when the offline cache arrives.
typedef CacheWipe = Future<void> Function();

@Riverpod(keepAlive: true)
CacheWipe cacheWipe(Ref ref) => () async {
  PaintingBinding.instance.imageCache
    ..clear()
    ..clearLiveImages();
};
