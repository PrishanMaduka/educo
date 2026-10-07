/// Time of day for the greeting header (spec 03, the greeting section).
enum GreetingPeriod { morning, afternoon, evening, night }

/// The greeting word; the text comes from the ARB.
enum GreetingWord { goodMorning, goodAfternoon, goodEvening, hello }

/// The greeting for a device-local time.
///
/// The API's `GET /family/home` computes this from M6 on; until then, and
/// offline later, the app falls back to the device clock (spec 03). The bands
/// mirror `greetingPeriod` in packages/domain and must stay identical to it.
({GreetingPeriod period, GreetingWord word}) greetingAt(DateTime local) {
  final hour = local.hour;
  if (hour >= 5 && hour < 12) {
    return (period: GreetingPeriod.morning, word: GreetingWord.goodMorning);
  }
  if (hour >= 12 && hour < 17) {
    return (period: GreetingPeriod.afternoon, word: GreetingWord.goodAfternoon);
  }
  if (hour >= 17 && hour < 20) {
    return (period: GreetingPeriod.evening, word: GreetingWord.goodEvening);
  }
  if (hour >= 20) {
    return (period: GreetingPeriod.night, word: GreetingWord.goodEvening);
  }
  return (period: GreetingPeriod.night, word: GreetingWord.hello);
}
