/**
 * A full page load, for anything that changes the session (sign-in, sign out, a support visit):
 * the next page then starts from the new session. Its own module so component tests can replace it.
 */
export function openPage(path: string): void {
  window.location.assign(path);
}

/** As `openPage`, without leaving the page asked for in the history (a signed-out deep link). */
export function replacePage(path: string): void {
  window.location.replace(path);
}
