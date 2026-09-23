import clsx from 'clsx';

import styles from './css/DagsterLogo.module.css';

const VIEWBOX_WIDTH = 223;
const VIEWBOX_HEIGHT = 48;

/**
 * Hillpointe mark, inlined so it needs no asset-pipeline handling. The source
 * is 225x225, well above the ~28px it renders at even on 3x displays. Swap for
 * inline SVG paths if a vector version of the mark turns up.
 */
const HP_MARK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAZlBMVEUCFIL///8ACYA+R5dJUJsAAHsAAH77/P7Q0uMAC4A2PpKtr80AEYFtc60AEYS2uNMQIYpZXp9hZaEfK406Q5VnbqtFTZoAAILZ2+iTl8BYXJ3HyNweJoews9AAGIYAFIZ2fLQQHIW91LqJAAACAklEQVR4nO3c226CQBRGYUQZq516aIEe1fb9X7LpDU4TyIxGZf7tWpdkCPNxB+xQTKxXjL2Bq4dQP4T6IdQPoX6BsKmnVqqbXmHrSiu5tlc4KwsrlTOE6iHUD6F+CPVDqB9C/RDqh1A/hPoh1A+hfgj1Q6gfQv0Q6odQP4T6IdQPoX4I9UOoH0L9EOqHUL9rCFfxfLjex8tL6Dfx9sGe/WtCOQkX9STeujqeUCWsf6uGL3h74TJhx48nCh8QIkSIECFChAiFhO/b566PT4vCpnJd1dqi8MkFxxEiRIgQIUKECBEiRIgQIUKEAsLuY+nCpnDnv7pWc4vCoRAiRIgQIUKECPMRzs9NQ1j4Q8JwYn+HcAgxX2HKNGXKlGXGwguFMDGEI4YwMYQjhjAxhCOWr3Dlzi+8bLZC+88Wd/F8iBAhQoQIESJE+Ndu/9J1MPkd3/4sxj3M0yBEiBAhQoQIESJEiBAhQoT3LTxOgNkUfm+Ob6j2JoVDIUSIECFChAgR3lqY8h/h3YnCrP4j7H+28ZaL4JZM44XrRxcWPmEG8d+Gy3jnA3OeL71QCPVDqB9C/RDqh1A/hPoh1A+hfgj1Q6gfQv0Q6odQP4T6IdQPoX4I9UOoH0L9EOqHUD+E+iHUb0DYuoShT41c2yts6oTBXY3qpldoNIT6IdQPoX4I9bMv/AW3aoRU+SRUaAAAAABJRU5ErkJggg==';

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

export const DagsterIcon = ({reversed = false, height = 48}: DagsterLogoProps) => {
  return (
    <svg
      className={clsx(styles.logo, reversed && styles.reversed)}
      width={height}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Hillpointe"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image href={HP_MARK} x="0" y="0" width="48" height="48" />
    </svg>
  );
};

export const DagsterLogo = ({reversed = false, height = 48}: DagsterLogoProps) => {
  return (
    <svg
      className={clsx(styles.logo, reversed && styles.reversed)}
      width={(height * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT}
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      fill="none"
      role="img"
      aria-label="Hillpointe"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image href={HP_MARK} x="0" y="0" width="48" height="48" />
      <text className={styles.wordmarkText} x="58" y="33">
        Hillpointe
      </text>
    </svg>
  );
};
