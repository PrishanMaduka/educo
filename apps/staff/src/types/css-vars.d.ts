import 'react';

declare module 'react' {
  /** CSS custom properties in `style`, the one inline style the UI rules allow (`--x: 6%`). */
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
