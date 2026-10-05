import {Icon} from '@dagster-io/ui-components';
import clsx from 'clsx';

import styles from './css/Mobile.module.css';
import {useDocumentTitle} from '../../hooks/useDocumentTitle';
import {BuildInfo} from '../../shared/app/UserSettingsDialog/UserPreferences';
import {THEME_OPTIONS} from '../time/ThemeSelect';
import {useThemeState} from '../useThemeState';

// eslint-disable-next-line import/no-default-export
export default function MobileSettings() {
  useDocumentTitle('Settings');
  const {theme, setTheme} = useThemeState();

  return (
    <div className={styles.runPage}>
      <div className={styles.sectionTitle}>Theme</div>
      <div className={styles.optionList}>
        {THEME_OPTIONS.map((option) => {
          const active = option.key === theme;
          return (
            <button
              key={option.key}
              type="button"
              className={clsx(styles.option, active && styles.optionActive)}
              onClick={() => setTheme(option.key)}
            >
              <Icon name={option.icon} />
              <span className={styles.optionLabel}>{option.label}</span>
              {active ? <Icon name="check_circle" /> : null}
            </button>
          );
        })}
      </div>

      <div className={styles.sectionTitle}>Build</div>
      <div className={styles.emptyNote}>
        <BuildInfo />
      </div>
    </div>
  );
}
