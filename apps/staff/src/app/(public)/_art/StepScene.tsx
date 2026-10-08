import { Doodle } from './Doodle';
import { Face } from './Face';
import { site } from './people';

const INK = site('navy');
const WHITE = site('white');
const rad = (deg: number) => (deg * Math.PI) / 180;
const twinkle = (delay: string) => `motion-safe:animate-twinkle [animation-duration:2.8s] ${delay}`;
const floatUp = (delay: string) => `motion-safe:animate-float-up ${delay}`;

export type StepSceneKind = 'moment' | 'thanks' | 'try' | 'sees';

/** The picture on each "round the circle" card (design/landing.html `scene()`). */
export function StepScene({ kind, clock }: { kind: StepSceneKind; clock: string }) {
  return (
    <svg viewBox="0 0 200 140" className="block size-full" aria-hidden="true" focusable="false">
      {kind === 'moment' ? (
        <>
          <Face who="okafor" x={18} y={34} size={84} />
          <g transform="rotate(9 140 72)">
            <rect x="106" y="26" width="70" height="82" rx="5" fill={WHITE} />
            <rect x="112" y="32" width="58" height="54" rx="3" fill={site('sky')} />
            <circle cx="158" cy="45" r="6" fill={site('orange')} />
            <polygon points="112,86 132,60 150,86" fill={site('school-green')} />
            <polygon points="134,86 152,68 170,86" fill={site('lime')} />
          </g>
          <Doodle kind="star" colour={INK} x={94} y={14} size={16} motion={twinkle('')} />
          <Doodle
            kind="star"
            colour={WHITE}
            x={176}
            y={100}
            size={14}
            motion={twinkle('[animation-delay:1s]')}
          />
        </>
      ) : null}
      {kind === 'thanks' ? (
        <>
          <Face who="priya" x={16} y={34} size={84} />
          <rect x="120" y="44" width="46" height="78" rx="9" fill={INK} />
          <rect x="124" y="50" width="38" height="64" rx="5" fill={WHITE} />
          <Doodle kind="heart" colour={INK} x={132} y={70} size={22} motion={floatUp('')} />
          <Doodle
            kind="heart"
            colour={WHITE}
            x={150}
            y={46}
            size={16}
            motion={floatUp('[animation-delay:.9s]')}
          />
          <Doodle
            kind="heart"
            colour={INK}
            x={112}
            y={30}
            size={14}
            motion={floatUp('[animation-delay:1.7s]')}
          />
        </>
      ) : null}
      {kind === 'try' ? (
        <>
          <Face who="maya" mood="laugh" x={10} y={50} size={70} />
          <Face who="daniel" x={120} y={40} size={76} />
          <ellipse cx="100" cy="118" rx="30" ry="6" fill={WHITE} />
          {[110, 102, 94].map((y) => (
            <ellipse
              key={y}
              cx="100"
              cy={y}
              rx="24"
              ry="7"
              fill={site('pancake')}
              stroke={site('pancake-edge')}
              strokeWidth="1.5"
            />
          ))}
          <rect x="94" y="84" width="12" height="6" rx="2" fill={site('butter')} />
          <Doodle
            kind="squiggle"
            colour={INK}
            x={86}
            y={54}
            size={16}
            motion={floatUp('[animation-delay:.2s]')}
          />
          <Doodle
            kind="squiggle"
            colour={INK}
            x={102}
            y={48}
            size={16}
            motion={floatUp('[animation-delay:1.2s]')}
          />
        </>
      ) : null}
      {kind === 'sees' ? (
        <>
          <g className="origin-bottom [transform-box:fill-box] motion-safe:animate-sway">
            <path d="M8 140 A44 44 0 0 1 96 140Z" fill={site('orange')} />
          </g>
          <g stroke={site('orange')} strokeWidth="4" strokeLinecap="round">
            {[200, 230, 260, 290, 320].map((a) => (
              <line
                key={a}
                x1={52 + 54 * Math.cos(rad(a))}
                y1={140 + 54 * Math.sin(rad(a))}
                x2={52 + 64 * Math.cos(rad(a))}
                y2={140 + 64 * Math.sin(rad(a))}
              />
            ))}
          </g>
          <text x="16" y="34" className="font-site text-[26px] font-extrabold" fill={INK}>
            {clock}
          </text>
          <Face who="okafor" x={108} y={30} size={84} />
          <Doodle
            kind="bubble"
            colour={WHITE}
            x={150}
            y={10}
            size={34}
            motion="motion-safe:animate-bob [animation-duration:3s]"
          />
        </>
      ) : null}
    </svg>
  );
}
