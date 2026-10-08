/*
 * The Leo card in "Wellbeing, early" (spec 19): his History marks over eight weeks, before and
 * after a support plan. Sample data, in percent of the chart's height.
 */
export const LEO_BEFORE = [88, 90, 86, 88, 74, 62, 54, 50] as const;
export const LEO_AFTER = [88, 90, 86, 88, 74, 70, 84, 92] as const;

export type BarTone = 'steady' | 'down' | 'up';

/**
 * How each week's bar is coloured: the first four weeks are steady; before the plan the last four
 * dip (alert); after it the last two recover (pine).
 */
export function leoBars(planned: boolean): { height: number; tone: BarTone }[] {
  return (planned ? LEO_AFTER : LEO_BEFORE).map((height, week) => {
    if (week < 4) return { height, tone: 'steady' };
    if (!planned) return { height, tone: 'down' };
    return { height, tone: week >= 6 ? 'up' : 'steady' };
  });
}
