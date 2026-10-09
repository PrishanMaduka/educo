import { create } from 'qrcode';

/** The quiet zone round the code, in modules (the QR standard asks for 4). */
const QUIET = 4;

/**
 * A QR code drawn as one SVG path from the `qrcode` module matrix, so its colours come from the
 * tokens. It stays dark on white in both themes: authenticator apps read that best.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size + QUIET * 2;
  let path = '';
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) path += `M${column + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-44 rounded-lg bg-site-white text-site-navy"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
