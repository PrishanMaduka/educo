import { cn } from '../lib/cn';

const WIDTH = 64;
const HEIGHT = 24;
/** Keeps the line and the end dot inside the box. */
const PAD = 2;

export interface SparklineProps {
  values: readonly number[];
  /** Rising is good and falling is bad, so the colour follows the trend. */
  trend: 'up' | 'down';
  /** Says what the line shows, for example "Attendance up 3 points this term". */
  label: string;
  className?: string;
}

function pointsOf(values: readonly number[]): [number, number][] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  return values.map((value, i) => {
    const x = values.length > 1 ? PAD + i * step : WIDTH - PAD;
    const y = span === 0 ? HEIGHT / 2 : PAD + (1 - (value - min) / span) * (HEIGHT - PAD * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

/** A 64 by 24 trend line with its last point marked. Pure SVG, so it renders on the server. */
export function Sparkline({ values, trend, label, className }: SparklineProps) {
  const points = pointsOf(values);
  const end = points[points.length - 1];
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className={cn('shrink-0', trend === 'up' ? 'text-good' : 'text-bad', className)}
    >
      {points.length > 1 ? (
        <polyline
          points={points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {end ? <circle cx={end[0]} cy={end[1]} r={2.5} fill="currentColor" /> : null}
    </svg>
  );
}
