import {DagsterIcon, Icon, Spinner} from '@dagster-io/ui-components';
import clsx from 'clsx';
import {ReactNode, Suspense, lazy} from 'react';
import {NavLink, Redirect, Switch, useLocation} from 'react-router-dom';

import {Route} from '../Route';
import styles from './css/Mobile.module.css';

const MobilePipelines = lazy(() => import('./MobilePipelines'));
const MobileRuns = lazy(() => import('./MobileRuns'));
const MobileRun = lazy(() => import('./MobileRun'));

// Phone layout: a top bar, the page, and a bottom tab bar. Mobile-only screens
// live under /m/*; every other route shows the regular page inside this shell.
const TABS = [
  {to: '/m/pipelines', label: 'Pipelines', icon: 'job' as const},
  {to: '/m/runs', label: 'Runs', icon: 'run' as const},
  {to: '/overview', label: 'Overview', icon: 'timeline' as const},
];

export const MobileLayout = ({children}: {children: ReactNode}) => {
  const {pathname} = useLocation();
  const tab = TABS.find((t) => pathname.startsWith(t.to));
  const isRunPage = /^\/runs\/[^/]+$/.test(pathname);
  const backTo = isRunPage ? '/m/runs' : '/m/pipelines';
  const title = tab?.label ?? (isRunPage ? 'Run' : 'Alinos');

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        {tab ? (
          <DagsterIcon height={24} />
        ) : (
          <NavLink to={backTo} className={styles.back} aria-label="Back">
            <Icon name="arrow_back" />
          </NavLink>
        )}
        <span className={styles.title}>{title}</span>
      </header>
      <div className={styles.body}>
        <Suspense
          fallback={
            <div className={styles.center}>
              <Spinner purpose="page" />
            </div>
          }
        >
          <Switch>
            <Route exact path={['/', '/hillpointe']}>
              <Redirect to="/m/pipelines" />
            </Route>
            <Route path="/m/pipelines">
              <MobilePipelines />
            </Route>
            <Route exact path="/runs">
              <Redirect to="/m/runs" />
            </Route>
            <Route path="/m/runs">
              <MobileRuns />
            </Route>
            <Route exact path="/runs/:runId">
              <MobileRun />
            </Route>
            <Route path="*">{children}</Route>
          </Switch>
        </Suspense>
      </div>
      <nav className={styles.tabBar}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={clsx(styles.tab, pathname.startsWith(t.to) && styles.tabActive)}
          >
            <Icon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
