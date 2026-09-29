import clsx from 'clsx';

import styles from './css/DagsterLogo.module.css';

// Alinos horizontal logo, as exported (alinos-horizontal.svg). The first path
// is the "A" mark; the rest spell the wordmark. The logo is a single colour,
// so every path takes the wordmark fill, which follows the theme.
const VIEWBOX = {x: 179.64, y: 256.52, width: 432.74, height: 78.66};
// The mark alone, sharing the full logo's vertical extent.
const MARK_VIEWBOX = {x: 179.64, y: 256.52, width: 116, height: 78.66};

const MARK_PATH =
  'M276.19,331.18h15.43l-22.29-34.67c-.53-.83-1.45-1.33-2.43-1.33h-12.79c-.66,0-1.27-.33-1.62-.89l-20.95-32.59c-.76-1.18-2.49-1.18-3.24,0l-44.66,69.47h46.28l21.88-34.03c.28-.43.75-.69,1.26-.69h0c.51,0,.99.26,1.26.69l21.88,34.03Z';

const WORDMARK_PATHS = [
  'M344.13,311.48h-3.97c-6.73,0-12.79,4.08-15.32,10.32h0s-4.9,0-4.9,0c-.15,0-.25-.15-.2-.29l16.27-38.39c.35-.83,1.53-.83,1.88,0l16.26,38.38c.06.15-.05.31-.21.31h-5.59c-.09,0-.18-.06-.21-.14l-4.02-10.18ZM342.22,306.62l-5.28-13.52c-.07-.19-.34-.19-.41,0l-5.48,13.52c-.06.15.05.3.2.3h10.76c.16,0,.26-.16.21-.3Z',
  'M384.16,282.73v33.74c0,.12.1.22.22.22h19.54c.13,0,.23.1.23.23v4.65c0,.13-.1.23-.23.23h-24.8c-.13,0-.23-.1-.23-.23v-38.84c0-.12.09-.21.21-.21h4.85c.12,0,.21.09.21.21Z',
  'M436.39,282.73v38.86c0,.12-.09.21-.21.21h-4.85c-.12,0-.21-.09-.21-.21v-38.86c0-.12.09-.21.21-.21h4.85c.12,0,.21.09.21.21Z',
  'M497.38,282.52c.12,0,.22.1.22.22v38.1c0,.83-1.01,1.25-1.6.66l-20.59-20.75c-2.49-2.53-6.79-.76-6.78,2.79l.07,18.05c0,.12-.1.21-.21.21h-4.9c-.12,0-.21-.1-.21-.21v-38.27c0-.73.89-1.09,1.4-.57l27.28,27.79c.14.14.38.04.38-.16l-.11-27.65c0-.12.1-.22.22-.22h4.84Z',
  'M522.76,292.19c1.81-3.08,4.25-5.53,7.3-7.36,3.06-1.83,6.4-2.74,10.02-2.74,3.55,0,7.08.98,10.12,2.82,2.98,1.8,5.38,4.19,7.17,7.18,1.83,3.04,2.81,6.56,2.81,10.1,0,3.62-.91,6.97-2.72,10.05-2.09,3.55-5.02,6.24-8.81,8.08-2.22,1.08-4.66,1.72-7.12,1.87-4.18.27-8.02-.61-11.5-2.62-3.08-1.77-5.51-4.19-7.31-7.25-1.75-2.98-2.64-6.27-2.69-9.85s.89-7.18,2.72-10.28ZM527.43,309.69c2.67,4.67,7.51,5.9,12.77,5.9,6.37,0,10.64-2.31,12.63-5.87,1.28-2.3,1.93-4.81,1.93-7.52s-.65-5.23-1.96-7.55c-1.3-2.32-3.08-4.15-5.32-5.49s-4.71-2.01-7.39-2.01-5.14.68-7.39,2.04c-2.25,1.36-4.01,3.2-5.3,5.51-1.29,2.32-1.93,4.84-1.93,7.55s.65,5.16,1.95,7.44Z',
  'M596.85,286.98c-2.14,0-3.83.48-5.08,1.44-1.25.96-1.87,2.27-1.87,3.94s.73,2.96,2.2,3.99c1.47,1.03,3.56,2.06,6.28,3.07,2.03.73,3.74,1.51,5.13,2.36,1.39.85,2.55,2.03,3.48,3.53.92,1.5,1.39,3.41,1.39,5.73,0,2.1-.53,4-1.58,5.7s-2.54,3.04-4.48,4.02c-1.94.98-4.21,1.47-6.82,1.47-2.43,0-4.76-.39-7.01-1.17-2.17-.75-4.08-1.7-5.74-2.84-.1-.07-.13-.21-.07-.32l2.1-3.76c.07-.12.22-.16.33-.07,1.3.95,2.84,1.76,4.63,2.43,1.88.71,3.64,1.06,5.27,1.06,2.1,0,3.94-.54,5.52-1.63,1.57-1.09,2.36-2.7,2.36-4.84,0-1.81-.66-3.25-1.98-4.32-1.32-1.07-3.18-2.07-5.57-3.01-2.21-.83-4.05-1.65-5.52-2.44-1.47-.8-2.73-1.89-3.78-3.29-1.05-1.39-1.58-3.14-1.58-5.24,0-3.08,1.08-5.57,3.23-7.47,2.15-1.9,4.95-2.91,8.39-3.02,4.16,0,8.02,1.01,11.59,3.04.11.06.16.21.1.32l-1.81,3.66c-.06.12-.2.16-.31.1-3.01-1.58-6.35-2.44-8.81-2.44Z',
];

export interface DagsterLogoProps {
  /**
   * Force the reversed (light-on-dark) variant. When omitted, the variant
   * follows the active Dagster theme, including the user's system color
   * scheme preference under the "System" themes.
   */
  reversed?: boolean;
  /** Rendered height in pixels. Width scales to preserve the aspect ratio. */
  height?: number;
}

const viewBoxAttr = (v: {x: number; y: number; width: number; height: number}) =>
  `${v.x} ${v.y} ${v.width} ${v.height}`;

export const DagsterIcon = ({reversed = false, height = 48}: DagsterLogoProps) => {
  return (
    <svg
      className={clsx(styles.logo, reversed && styles.reversed)}
      width={(height * MARK_VIEWBOX.width) / MARK_VIEWBOX.height}
      height={height}
      viewBox={viewBoxAttr(MARK_VIEWBOX)}
      role="img"
      aria-label="Alinos"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className={styles.wordmark} d={MARK_PATH} />
    </svg>
  );
};

export const DagsterLogo = ({reversed = false, height = 48}: DagsterLogoProps) => {
  return (
    <svg
      className={clsx(styles.logo, reversed && styles.reversed)}
      width={(height * VIEWBOX.width) / VIEWBOX.height}
      height={height}
      viewBox={viewBoxAttr(VIEWBOX)}
      role="img"
      aria-label="Alinos"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className={styles.wordmark} d={MARK_PATH} />
      {WORDMARK_PATHS.map((d, i) => (
        <path key={i} className={styles.wordmark} d={d} />
      ))}
    </svg>
  );
};
