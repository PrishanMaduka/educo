import 'package:intl/intl.dart';

/// "Monday 5 October", the date line above the greeting.
String formatDayDate(DateTime date, String locale) =>
    DateFormat('EEEE d MMMM', locale).format(date);
