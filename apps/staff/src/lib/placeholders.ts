/*
 * Until sign-in exists (M1), the shell shows the seeded school and admin. These are sample data, not copy:
 * they come from the session and the school's settings once those exist.
 */
// TODO(M1): read the school, its time zone and the signed-in person from the session.
export const PLACEHOLDER_SCHOOL = {
  name: 'Colombo International School',
  timeZone: 'Asia/Colombo',
} as const;

export const PLACEHOLDER_USER = {
  name: 'Prishan Maduka',
  firstName: 'Prishan',
  role: 'Administrator',
} as const;
