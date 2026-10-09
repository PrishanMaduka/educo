/**
 * English defaults for every string a @quad/ui component can show when its caller does not pass one.
 * Each key is a key in packages/contracts/i18n/en.json, and defaults.test.ts fails if a value drifts from it.
 * Placeholders such as {label} are filled with `fill`.
 */
export const uiText = {
  'search.placeholder': 'Search students, staff and pages',
  'ui.drawer.close': 'Close',
  'ui.drawer.steps': 'Progress',
  'ui.drawer.discard.title': 'Discard changes?',
  'ui.drawer.discard.body': 'What you have entered has not been saved.',
  'ui.drawer.discard.keep': 'Keep editing',
  'ui.drawer.discard.confirm': 'Discard',
  'ui.palette.label': 'Search',
  'ui.filter.clear': 'Clear {label}',
  'ui.filter.search': 'Search {label}',
  'ui.filter.empty': 'No results',
  'ui.select.placeholder': 'Choose one',
  'ui.table.selectAll': 'Select all rows',
  'ui.table.selectRow': 'Select {label}',
  'ui.toast.region': 'Notifications',
  'ui.matrix.module': 'Module',
  'ui.matrix.notInPlan': 'Not in plan',
  'ui.matrix.cell': '{action} in {module}',
  'ui.actionMenu.label': 'More actions',
} as const;

export type UiTextKey = keyof typeof uiText;

/** Replaces each {name} in a default with its value. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}
