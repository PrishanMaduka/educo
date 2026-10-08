import { site } from './people';

const INK = site('navy');
const LEAVES = [
  [170, -1, 'sky'],
  [150, 1, 'pink'],
  [130, -1, 'sky'],
  [110, 1, 'orange'],
  [92, -1, 'sky'],
  [74, 1, 'pink'],
  [58, -1, 'orange'],
] as const;
const PETALS = [0, 72, 144, 216, 288];

/** The parent view's weekly recap: a plant with a leaf for each moment this week. */
export function Plant({ label, pot }: { label: string; pot: string }) {
  return (
    <svg viewBox="0 0 200 250" role="img" aria-label={label} className="h-full overflow-visible">
      <g className="origin-[100px_200px] [transform-box:view-box] motion-safe:animate-sway [animation-duration:5s]">
        <path
          d="M100 198 C 94 160 108 120 100 44"
          stroke={site('pine')}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        {LEAVES.map(([y, side, colour]) => (
          <ellipse
            key={y}
            cx={100 + side * 17}
            cy={y}
            rx="16"
            ry="7.5"
            fill={site(colour)}
            transform={`rotate(${side * -28} ${100 + side * 17} ${y})`}
          />
        ))}
        {PETALS.map((a) => (
          <circle
            key={a}
            cx={100 + 11 * Math.cos((a * Math.PI) / 180)}
            cy={40 + 11 * Math.sin((a * Math.PI) / 180)}
            r="9"
            fill={site('pink')}
          />
        ))}
        <circle cx="100" cy="40" r="7" fill={site('orange')} />
      </g>
      <rect x="56" y="194" width="88" height="12" rx="5" fill={site('orange')} />
      <path d="M62 206 L138 206 L128 244 L72 244Z" fill={site('orange')} />
      <text
        x="100"
        y="230"
        textAnchor="middle"
        className="font-site text-[13px] font-extrabold"
        fill={INK}
      >
        {pot}
      </text>
    </svg>
  );
}
