import { logoPalette } from './palette';
import { MarkShapes, type QuadMarkProps } from './QuadMark';

const VIEW_WIDTH = 292;
const VIEW_HEIGHT = 86;

export type QuadLogoProps = QuadMarkProps;

/** The mark with the lowercase "quad" wordmark. `size` is the height in px. */
export function QuadLogo({ variant = 'color', size = 32, title = 'Quad', ...rest }: QuadLogoProps) {
  const word = logoPalette[variant].word;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`-4 -4 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={Math.round((size * VIEW_WIDTH) / VIEW_HEIGHT)}
      height={size}
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      <g transform="translate(0 -1.6) scale(1.3)">
        <MarkShapes variant={variant} />
      </g>
      <g transform="translate(94 0)">
        <g fill="none" stroke={word} strokeWidth="9" strokeLinecap="round">
          <circle cx="20" cy="40" r="15.5" />
          <path d="M35.5 25V76" />
          <path d="M54.5 24V40A15.5 15.5 0 0 0 85.5 40M85.5 24V60" />
          <circle cx="120" cy="40" r="15.5" />
          <path d="M135.5 25V60" />
          <circle cx="170" cy="40" r="15.5" />
          <path d="M185.5 4V60" />
        </g>
      </g>
    </svg>
  );
}
