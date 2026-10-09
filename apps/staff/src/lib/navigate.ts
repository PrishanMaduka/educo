/**
 * A full page load, for anything that changes the session (sign out, Switch school, a role
 * preview): the server layout then reads the new session and brand from the start. Its own
 * module so component tests can replace it.
 */
export function openPage(path: string): void {
  window.location.assign(path);
}
