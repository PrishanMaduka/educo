/*
 * Sample data for the leaders' heatmap (spec 19 §8: static sample data, no API). The year groups
 * and classes belong to the fictional sample school, as data, not copy.
 */

export const SAMPLE_CLASSES = ['Emerald', 'Sapphire', 'Ruby'] as const;

export interface SampleHeatRow {
  yearGroup: string;
  /** Share of families who heard something positive in two weeks, per class, in percent. */
  values: readonly [number, number, number];
}

export const SAMPLE_HEAT_ROWS: readonly SampleHeatRow[] = [
  { yearGroup: 'Year 1', values: [92, 88, 95] },
  { yearGroup: 'Year 2', values: [85, 90, 78] },
  { yearGroup: 'Year 3', values: [81, 64, 87] },
  { yearGroup: 'Year 4', values: [96, 83, 90] },
  { yearGroup: 'Year 5', values: [72, 86, 58] },
  { yearGroup: 'Year 6', values: [88, 91, 80] },
];

/** The heat token for a share: coral below 70 %, then three teal steps (spec 19 heatmap key). */
export function heatStep(percent: number): 0 | 1 | 2 | 3 {
  if (percent >= 90) return 3;
  if (percent >= 80) return 2;
  if (percent >= 70) return 1;
  return 0;
}
