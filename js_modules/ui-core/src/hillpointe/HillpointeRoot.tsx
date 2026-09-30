import {
  Box,
  Button,
  ButtonGroup,
  Colors,
  Icon,
  NonIdealState,
  Spinner,
  Table,
  Tag,
  Tooltip,
} from '@dagster-io/ui-components';
import clsx from 'clsx';
import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';

import {gql, useQuery} from '../apollo-client';
import styles from './css/HillpointeRoot.module.css';
import {
  HillpointeRowCountQuery,
  HillpointeRowCountQueryVariables,
  HillpointeRunHistoryQuery,
  HillpointeRunHistoryQueryVariables,
  HillpointeRunMetricsQuery,
  HillpointeRunMetricsQueryVariables,
  HillpointeRunStatsQuery,
  HillpointeRunStatsQueryVariables,
  HillpointeRunStepStatsQuery,
  HillpointeRunStepStatsQueryVariables,
} from './types/HillpointeRoot.types';
import {
  FIFTEEN_SECONDS,
  QueryRefreshCountdown,
  useQueryRefreshAtInterval,
} from '../app/QueryRefresh';
import {useTrackPageView} from '../app/analytics';
import {RunStatus, StepEventStatus} from '../graphql/types';
import {useDocumentTitle} from '../hooks/useDocumentTitle';
import {useStateWithStorage} from '../hooks/useStateWithStorage';
import {RunStatusTag} from '../runs/RunStatusTag';

// Runs are scoped to the current month; the limit is a safety cap.
const MONTH_RUN_LIMIT = 5000;
const TABLE_ROWS = 50;
const TREND_DAYS = 30;
const ROLLING_DAYS = 7;
const HISTORY_DAYS = 90;

type Run = Extract<
  HillpointeRunMetricsQuery['runsOrError'],
  {__typename: 'Runs'}
>['results'][number];

type RunStats = {stepsSucceeded: number; stepsFailed: number; materializations: number};
/** Stats keyed by run id; null until the stats query has answered. */
type StatsByRun = Map<string, RunStats> | null;

// Status buckets. Colours are theme tokens, so every chart follows the selected theme.
type Bucket = 'success' | 'failure' | 'canceled' | 'inProgress' | 'queued';

const BUCKETS: {key: Bucket; label: string; color: string}[] = [
  {key: 'success', label: 'Succeeded', color: Colors.dataVizGreen()},
  {key: 'failure', label: 'Failed', color: Colors.dataVizRed()},
  {key: 'canceled', label: 'Canceled', color: Colors.dataVizGray()},
  {key: 'inProgress', label: 'In progress', color: Colors.dataVizBlue()},
  {key: 'queued', label: 'Queued', color: Colors.dataVizYellow()},
];

const bucketFor = (status: RunStatus): Bucket => {
  switch (status) {
    case RunStatus.SUCCESS:
      return 'success';
    case RunStatus.FAILURE:
      return 'failure';
    case RunStatus.CANCELED:
    case RunStatus.CANCELING:
      return 'canceled';
    case RunStatus.QUEUED:
    case RunStatus.NOT_STARTED:
      return 'queued';
    default:
      return 'inProgress';
  }
};

const STEP_COLOR: Record<StepEventStatus, string> = {
  [StepEventStatus.SUCCESS]: Colors.dataVizGreen(),
  [StepEventStatus.FAILURE]: Colors.dataVizRed(),
  [StepEventStatus.SKIPPED]: Colors.dataVizGray(),
  [StepEventStatus.IN_PROGRESS]: Colors.dataVizBlue(),
};

/** Seconds a run (or step) has taken so far, or null if it never started. */
const durationSec = (start: number | null, end: number | null) =>
  start ? (end ?? Date.now() / 1000) - start : null;

const formatDuration = (sec: number | null) => {
  if (sec === null) {
    return '—';
  }
  if (sec < 60) {
    return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
  }
  const m = Math.floor(sec / 60);
  if (m < 60) {
    return `${m}m ${Math.round(sec % 60)}s`;
  }
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const HillpointeRoot = () => {
  useTrackPageView();
  useDocumentTitle('Hillpointe');

  // Fixed for the life of the page so the query variables stay stable.
  const [monthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const queryResult = useQuery<HillpointeRunMetricsQuery, HillpointeRunMetricsQueryVariables>(
    HILLPOINTE_RUN_METRICS_QUERY,
    {variables: {after: monthStart.getTime() / 1000, limit: MONTH_RUN_LIMIT}},
  );
  const refreshState = useQueryRefreshAtInterval(queryResult, FIFTEEN_SECONDS);
  const {data, loading} = queryResult;
  const runs = useMemo(
    () => (data?.runsOrError.__typename === 'Runs' ? data.runsOrError.results : []),
    [data],
  );

  const statsResult = useQuery<HillpointeRunStatsQuery, HillpointeRunStatsQueryVariables>(
    HILLPOINTE_RUN_STATS_QUERY,
    {variables: {after: monthStart.getTime() / 1000, limit: MONTH_RUN_LIMIT}},
  );
  useQueryRefreshAtInterval(statsResult, FIFTEEN_SECONDS);
  const statsByRun: StatsByRun = useMemo(() => {
    const result = statsResult.data?.runsOrError;
    if (result?.__typename !== 'Runs') {
      return null;
    }
    const map = new Map<string, RunStats>();
    result.results.forEach((r) => {
      if (r.stats.__typename === 'RunStatsSnapshot') {
        map.set(r.runId, r.stats);
      }
    });
    return map;
  }, [statsResult.data]);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun = runs.find((r) => r.runId === selectedRunId) ?? runs[0] ?? null;

  const content = () => {
    if (!data && loading) {
      return (
        <Box padding={64} flex={{justifyContent: 'center'}}>
          <Spinner purpose="page" />
        </Box>
      );
    }
    if (!runs.length) {
      return (
        <Box padding={64}>
          <NonIdealState
            icon="run"
            title="No runs yet"
            description="Launch a job and its metrics will show up here."
          />
        </Box>
      );
    }
    return (
      <div className={styles.page}>
        <Box flex={{justifyContent: 'flex-end'}}>
          <QueryRefreshCountdown refreshState={refreshState} />
        </Box>
        <SummaryTiles runs={runs} statsByRun={statsByRun} />
        <div className={styles.chartGrid}>
          <TrendCard runs={runs} />
          <RunStatusBlock />
        </div>
        {selectedRun ? (
          <RunBreakdown
            run={selectedRun}
            stats={statsByRun?.get(selectedRun.runId) ?? null}
            isLatest={selectedRun === runs[0]}
            onShowLatest={() => setSelectedRunId(null)}
          />
        ) : null}
        <RunsTable
          runs={runs}
          statsByRun={statsByRun}
          selectedRunId={selectedRun?.runId ?? null}
          onSelect={setSelectedRunId}
        />
      </div>
    );
  };

  return (
    <Box flex={{direction: 'column'}} style={{height: '100%', overflow: 'hidden'}}>
      {content()}
    </Box>
  );
};

const Tile = ({label, value, sub}: {label: string; value: string; sub?: string}) => (
  <div className={styles.tile}>
    <div className={styles.tileLabel}>{label}</div>
    <div className={styles.tileValue}>{value}</div>
    {sub ? <div className={styles.tileSub}>{sub}</div> : null}
  </div>
);

const SummaryTiles = ({runs, statsByRun}: {runs: Run[]; statsByRun: StatsByRun}) => {
  const monthLabel = new Date().toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  const counts = {success: 0, failure: 0, canceled: 0, inProgress: 0, queued: 0};
  runs.forEach((r) => counts[bucketFor(r.status)]++);
  // Canceled runs are neither passes nor failures, so they sit outside the rate.
  const finished = counts.success + counts.failure;
  const durations = runs
    .filter((r) => r.endTime)
    .map((r) => durationSec(r.startTime, r.endTime))
    .filter((d): d is number => d !== null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const materializations = statsByRun
    ? runs.reduce((sum, r) => sum + (statsByRun.get(r.runId)?.materializations ?? 0), 0)
    : null;

  return (
    <div className={styles.tiles}>
      <Tile label="Runs" value={`${runs.length}`} sub={monthLabel} />
      <Tile
        label="Success rate"
        value={finished ? `${Math.round((counts.success / finished) * 100)}%` : '—'}
        sub={[
          `${counts.success} passed`,
          `${counts.failure} failed`,
          `${counts.canceled} canceled`,
          `${counts.inProgress + counts.queued} running`,
        ].join(' · ')}
      />
      <Tile label="Failed" value={`${counts.failure}`} sub={`${counts.canceled} canceled`} />
      <Tile label="Avg duration" value={formatDuration(avg)} sub="Finished runs" />
      <Tile
        label="Active"
        value={`${counts.inProgress + counts.queued}`}
        sub={`${counts.inProgress} running, ${counts.queued} queued`}
      />
      <Tile
        label="Materializations"
        value={materializations === null ? '…' : `${materializations}`}
        sub="This month"
      />
    </div>
  );
};

const Legend = ({items}: {items: {label: string; color: string}[]}) => (
  <div className={styles.legend}>
    {items.map((item) => (
      <div key={item.label} className={styles.legendItem}>
        <span className={styles.swatch} style={{background: item.color}} />
        {item.label}
      </div>
    ))}
  </div>
);

type HistoryRun = Extract<
  HillpointeRunHistoryQuery['runsOrError'],
  {__typename: 'Runs'}
>['results'][number];

const EMPTY_DAY = Colors.backgroundLighter();
// Written by each copy step; the same label scripts/daily_row_totals.py sums.
const ROW_COUNT_LABEL = 'rows_copied';

// Share of finished runs that succeeded: at or above GOOD is green, at or above
// MIXED is yellow, below that is red.
const HEALTH_GOOD = 0.8;
const HEALTH_MIXED = 0.5;

type Health = 'good' | 'mixed' | 'bad' | 'running' | 'none';

// Canceled runs are neither passes nor failures, so they sit outside the rate.
const healthFor = (counts: Partial<Record<Bucket, number>>): Health => {
  const finished = (counts.success ?? 0) + (counts.failure ?? 0);
  if (!finished) {
    return counts.inProgress || counts.queued ? 'running' : 'none';
  }
  const rate = (counts.success ?? 0) / finished;
  return rate >= HEALTH_GOOD ? 'good' : rate >= HEALTH_MIXED ? 'mixed' : 'bad';
};

const HEALTH_FILL: Record<Health, string> = {
  good: Colors.dataVizGreen(),
  mixed: Colors.dataVizYellow(),
  bad: Colors.dataVizRed(),
  running: Colors.dataVizBlue(),
  none: EMPTY_DAY,
};

const HEALTH_TEXT: Record<Health, string> = {
  good: Colors.textGreen(),
  mixed: Colors.textYellow(),
  bad: Colors.textRed(),
  running: Colors.textBlue(),
  none: Colors.textLighter(),
};

const startOfDay = (daysAgo: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
};

const RunStatusBlock = () => {
  // Fixed for the life of the page so the query variables stay stable.
  const [historyStart] = useState(() => startOfDay(HISTORY_DAYS - 1));
  const [yesterdayStart] = useState(() => startOfDay(1));

  const historyResult = useQuery<HillpointeRunHistoryQuery, HillpointeRunHistoryQueryVariables>(
    HILLPOINTE_RUN_HISTORY_QUERY,
    {variables: {after: historyStart.getTime() / 1000}},
  );
  useQueryRefreshAtInterval(historyResult, FIFTEEN_SECONDS);
  const rowCountResult = useQuery<HillpointeRowCountQuery, HillpointeRowCountQueryVariables>(
    HILLPOINTE_ROW_COUNT_QUERY,
    {variables: {after: yesterdayStart.getTime() / 1000}},
  );
  useQueryRefreshAtInterval(rowCountResult, FIFTEEN_SECONDS);

  const runs: HistoryRun[] = useMemo(() => {
    const result = historyResult.data?.runsOrError;
    return result?.__typename === 'Runs' ? result.results : [];
  }, [historyResult.data]);

  const days = useMemo(() => {
    const list = Array.from({length: HISTORY_DAYS}, (_, i) => {
      const date = new Date(historyStart);
      date.setDate(historyStart.getDate() + i);
      return {date, counts: {} as Partial<Record<Bucket, number>>, total: 0};
    });
    const byKey = new Map(list.map((d) => [dayKey(d.date), d]));
    runs.forEach((r) => {
      const day = byKey.get(dayKey(new Date(r.creationTime * 1000)));
      if (day) {
        const bucket = bucketFor(r.status);
        day.counts[bucket] = (day.counts[bucket] ?? 0) + 1;
        day.total++;
      }
    });
    return list;
  }, [runs, historyStart]);

  // Same rules as scripts/daily_row_totals.py: sum each step's rows_copied, credited to the
  // day the run started. null means no step recorded a count that day.
  const rowCounts = useMemo(() => {
    const result = rowCountResult.data?.runsOrError;
    const totals: {yesterday: number | null; today: number | null} = {
      yesterday: null,
      today: null,
    };
    const todayStart = startOfDay(0).getTime() / 1000;
    const yesterdayStartSec = yesterdayStart.getTime() / 1000;
    (result?.__typename === 'Runs' ? result.results : []).forEach((run) => {
      if (!run.startTime || run.startTime < yesterdayStartSec) {
        return;
      }
      const day = run.startTime >= todayStart ? 'today' : 'yesterday';
      run.assetMaterializations.forEach((m) =>
        m.metadataEntries.forEach((e) => {
          if (e.__typename === 'IntMetadataEntry' && e.label === ROW_COUNT_LABEL) {
            totals[day] = (totals[day] ?? 0) + Number(e.intRepr);
          }
        }),
      );
    });
    return totals;
  }, [rowCountResult.data, yesterdayStart]);

  const today = days[days.length - 1];
  const todayFinished = today ? (today.counts.success ?? 0) + (today.counts.failure ?? 0) : 0;
  const todayRunning = (today?.total ?? 0) - todayFinished - (today?.counts.canceled ?? 0);
  const todayHealth = healthFor(today?.counts ?? {});
  const week = days
    .slice(-7)
    .reduce(
      (acc, d) => ({total: acc.total + d.total, failed: acc.failed + (d.counts.failure ?? 0)}),
      {total: 0, failed: 0},
    );
  // Runs arrive newest first.
  const lastFailure = runs.find((r) => bucketFor(r.status) === 'failure');

  return (
    <div className={styles.card}>
      <div className={styles.jobHeader}>
        <div className={styles.jobTitle}>
          <span className={styles.dot} style={{background: HEALTH_FILL[todayHealth]}} />
          Pipeline runs
          <Tooltip content="Colour is the share of finished runs that succeeded: green for 80% or more, yellow for 50–79%, red below 50%. Blue: runs still going, none finished yet. Empty: no runs. Row counts add up the rows_copied each step records, by the day its run started; — means no step recorded a count.">
            <Icon name="info" color={Colors.textLighter()} />
          </Tooltip>
        </div>
      </div>
      <div className={styles.statusBody}>
        <div className={styles.statusLeft}>
          <div className={styles.statGrid}>
            <div className={styles.miniTile}>
              <div className={styles.tileLabel}>Row count yesterday</div>
              <div className={styles.jobStatValue}>
                {rowCounts.yesterday?.toLocaleString() ?? '—'}
              </div>
            </div>
            <div className={styles.miniTile}>
              <div className={styles.tileLabel}>Row count today</div>
              <div className={styles.jobStatValue}>{rowCounts.today?.toLocaleString() ?? '—'}</div>
            </div>
            <div className={styles.miniTile}>
              <div className={styles.tileLabel}>Today&apos;s status</div>
              <div className={styles.jobStatValue} style={{color: HEALTH_TEXT[todayHealth]}}>
                {today?.total
                  ? `${today.counts.success ?? 0}/${todayFinished} passed${
                      todayRunning ? `, ${todayRunning} running` : ''
                    }`
                  : 'No runs'}
              </div>
            </div>
            <div className={styles.miniTile}>
              <div className={styles.tileLabel}>Runs, last 7 days</div>
              <div className={styles.jobStatValue}>{week.total}</div>
            </div>
            <div className={styles.miniTile}>
              <div className={styles.tileLabel}>Failed, last 7 days</div>
              <div
                className={styles.jobStatValue}
                style={{color: week.failed ? Colors.textRed() : undefined}}
              >
                {week.failed}
              </div>
            </div>
            <div className={styles.miniTile}>
              <div className={styles.tileLabel}>Last failure</div>
              <div className={styles.jobStatValue}>
                {lastFailure
                  ? new Date(lastFailure.creationTime * 1000).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'None'}
              </div>
            </div>
          </div>
        </div>
        <RunMonthCalendar days={days} />
      </div>
    </div>
  );
};

type DayCounts = {date: Date; counts: Partial<Record<Bucket, number>>; total: number};

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A month as a calendar: one dot per day, coloured by that day's health. Arrows
 * step back through the months the loaded history covers, and forward to today.
 */
const RunMonthCalendar = ({days}: {days: DayCounts[]}) => {
  // 0 is the current month, -1 the month before, and so on.
  const [offset, setOffset] = useState(0);
  const byKey = new Map(days.map((d) => [dayKey(d.date), d]));
  const today = startOfDay(0);
  const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  // Can't go further back than the month holding the oldest loaded day.
  const oldest = days[0]?.date ?? today;
  const canGoBack = monthStart > new Date(oldest.getFullYear(), oldest.getMonth(), 1);
  // Leading blanks so the 1st lands on its weekday, Monday first.
  const lead = (monthStart.getDay() + 6) % 7;
  const cells = [
    ...Array.from({length: lead}, () => null),
    ...Array.from({length: daysInMonth}, (_, i) => {
      const date = new Date(monthStart);
      date.setDate(i + 1);
      return {date, day: byKey.get(dayKey(date)), future: date > today};
    }),
  ];

  return (
    <div className={styles.month}>
      <div className={styles.monthNav}>
        <Button
          icon={<Icon name="chevron_left" />}
          disabled={!canGoBack}
          onClick={() => setOffset(offset - 1)}
          aria-label="Previous month"
        />
        <div className={styles.monthTitle}>
          {monthStart.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
        </div>
        <Button
          icon={<Icon name="chevron_right" />}
          disabled={offset === 0}
          onClick={() => setOffset(offset + 1)}
          aria-label="Next month"
        />
      </div>
      <div className={styles.monthGrid}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <div key={i} className={styles.calHead}>
            {letter}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`lead-${i}`} />;
          }
          const {date, day, future} = cell;
          const health = future ? 'none' : healthFor(day?.counts ?? {});
          const dot = (
            <div
              className={clsx(styles.monthDot, future && styles.monthFuture)}
              style={{
                background: HEALTH_FILL[health],
                color: health === 'none' ? Colors.textLighter() : Colors.backgroundDefault(),
              }}
            >
              {date.getDate()}
            </div>
          );
          return future ? (
            <span key={date.toISOString()}>{dot}</span>
          ) : (
            <Tooltip
              key={date.toISOString()}
              content={
                <div>
                  <strong>{date.toLocaleDateString()}</strong>:{' '}
                  {day?.total ? `${day.total} runs` : 'No runs'}
                  {BUCKETS.filter((b) => day?.counts[b.key]).map((b) => (
                    <div key={b.key}>
                      {b.label}: {day?.counts[b.key]}
                    </div>
                  ))}
                </div>
              }
            >
              {dot}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

const bucketColor = (status: RunStatus) =>
  BUCKETS.find((b) => b.key === bucketFor(status))?.color ?? Colors.dataVizGray();

const HOUR = 3600;

const formatHour = (secs: number) =>
  new Date(secs * 1000).toLocaleTimeString(undefined, {hour: 'numeric'});

/** Today's runs as bars on a midnight-to-now axis, one row per job. */
const TodayTimeline = ({runs}: {runs: Run[]}) => {
  const dayStart = startOfDay(0).getTime() / 1000;
  const now = Date.now() / 1000;
  // The axis ends on the next whole hour so the newest run isn't flush right.
  const axisEnd = Math.ceil((now + 1) / HOUR) * HOUR;
  const span = axisEnd - dayStart;
  const pct = (secs: number) => `${((secs - dayStart) / span) * 100}%`;

  const byJob = new Map<string, Run[]>();
  runs
    .filter((r) => r.startTime && r.startTime >= dayStart)
    .forEach((r) => byJob.set(r.jobName, [...(byJob.get(r.jobName) ?? []), r]));
  const firstStart = (list: Run[]) => Math.min(...list.map((r) => r.startTime ?? Infinity));
  const jobs = [...byJob.entries()].sort((a, b) => firstStart(a[1]) - firstStart(b[1]));

  const tickEvery = span > 12 * HOUR ? 6 * HOUR : 3 * HOUR;
  const ticks: number[] = [];
  for (let t = dayStart; t <= axisEnd; t += tickEvery) {
    ticks.push(t);
  }

  return (
    <>
      <Legend items={BUCKETS} />
      {jobs.length ? (
        <div className={styles.tlRows}>
          {jobs.map(([job, jobRuns]) => (
            <div key={job} className={styles.tlRow}>
              <div className={styles.stepName} title={job}>
                {job}
              </div>
              <div className={styles.tlTrack}>
                {jobRuns.map((run) => {
                  const start = run.startTime ?? dayStart;
                  const end = run.endTime ?? now;
                  return (
                    <Tooltip
                      key={run.runId}
                      content={
                        <div>
                          <strong>{run.jobName}</strong> · {run.runId.slice(0, 8)}
                          <div>
                            {new Date(start * 1000).toLocaleTimeString()}
                            {run.endTime
                              ? ` – ${new Date(end * 1000).toLocaleTimeString()}`
                              : ' – now'}
                            {' · '}
                            {formatDuration(end - start)} · {run.status}
                          </div>
                        </div>
                      }
                    >
                      <Link to={`/runs/${run.runId}`}>
                        <div
                          className={styles.tlBar}
                          style={{
                            left: pct(start),
                            width: `${((end - start) / span) * 100}%`,
                            background: bucketColor(run.status),
                          }}
                        />
                      </Link>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.muted}>No runs yet today.</div>
      )}
      <div className={styles.tlRow}>
        <div />
        <div className={styles.tlAxis}>
          {ticks.map((t) => (
            <span key={t} style={{left: pct(t)}}>
              {t === ticks[ticks.length - 1] ? 'now' : formatHour(t)}
            </span>
          ))}
        </div>
      </div>
    </>
  );
};

type TrendMode = 'rate' | 'timeline';
const TREND_MODE_KEY = 'hillpointe-trend-mode';
const TREND_MODES: {id: TrendMode; label: string; sub: string}[] = [
  {id: 'rate', label: 'Success rate', sub: `${ROLLING_DAYS}-day rolling, last ${TREND_DAYS} days`},
  {id: 'timeline', label: "Today's runs", sub: 'When each job ran, and for how long'},
];

/** One card that switches between the two trend charts. */
const TrendCard = ({runs}: {runs: Run[]}) => {
  const [mode, setMode] = useStateWithStorage<TrendMode>(TREND_MODE_KEY, (value) =>
    TREND_MODES.some((m) => m.id === value) ? value : 'rate',
  );
  const current = TREND_MODES.find((m) => m.id === mode) ?? TREND_MODES[0];
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          {current?.label}
          <span className={styles.cardSub}>{current?.sub}</span>
        </div>
        <ButtonGroup<TrendMode>
          activeItems={new Set([mode])}
          buttons={TREND_MODES.map(({id, label}) => ({id, label}))}
          onClick={setMode}
        />
      </div>
      {mode === 'rate' ? <SuccessRateTrend /> : null}
      {mode === 'timeline' ? <TodayTimeline runs={runs} /> : null}
    </div>
  );
};

const TREND_HEIGHT = 160;

/**
 * Rolling success rate over the last TREND_DAYS days, as a line. Each point is
 * the share of finished runs that succeeded in the ROLLING_DAYS days ending on
 * that day, so one bad run nudges the line rather than dropping it to zero.
 */
const SuccessRateTrend = () => {
  // Same variables as RunStatusBlock's history query, so Apollo serves it from cache.
  const [historyStart] = useState(() => startOfDay(HISTORY_DAYS - 1));
  const queryResult = useQuery<HillpointeRunHistoryQuery, HillpointeRunHistoryQueryVariables>(
    HILLPOINTE_RUN_HISTORY_QUERY,
    {variables: {after: historyStart.getTime() / 1000}},
  );
  useQueryRefreshAtInterval(queryResult, FIFTEEN_SECONDS);

  const days = useMemo(() => {
    const result = queryResult.data?.runsOrError;
    const runs = result?.__typename === 'Runs' ? result.results : [];
    // Daily counts reach back an extra window so the first point has a full one.
    const span = TREND_DAYS + ROLLING_DAYS - 1;
    const daily = Array.from({length: span}, (_, i) => ({
      date: startOfDay(span - 1 - i),
      succeeded: 0,
      finished: 0,
    }));
    const byKey = new Map(daily.map((d) => [dayKey(d.date), d]));
    runs.forEach((r) => {
      const day = byKey.get(dayKey(new Date(r.creationTime * 1000)));
      const bucket = bucketFor(r.status);
      if (day && (bucket === 'success' || bucket === 'failure')) {
        day.finished++;
        day.succeeded += bucket === 'success' ? 1 : 0;
      }
    });
    return daily.slice(ROLLING_DAYS - 1).map((d, i) => {
      const window = daily.slice(i, i + ROLLING_DAYS);
      const succeeded = window.reduce((sum, w) => sum + w.succeeded, 0);
      const finished = window.reduce((sum, w) => sum + w.finished, 0);
      return {date: d.date, succeeded, finished, rate: finished ? succeeded / finished : null};
    });
  }, [queryResult.data]);

  const latest = days[days.length - 1];
  const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

  // Points sit at column centres; a window with no finished runs breaks the line.
  const step = 100 / TREND_DAYS;
  const x = (i: number) => (i + 0.5) * step;
  const y = (rate: number) => TREND_HEIGHT - rate * TREND_HEIGHT;
  const path = days
    .map((d, i) => (d.rate === null ? '' : `${x(i)},${y(d.rate)}`))
    .reduce((acc, point, i, all) => {
      if (!point) {
        return acc;
      }
      const prev = i > 0 ? all[i - 1] : '';
      return `${acc}${prev ? 'L' : 'M'}${point} `;
    }, '');

  return (
    <>
      <Box flex={{alignItems: 'baseline', gap: 12}}>
        <div className={styles.tileValue}>{pct(latest?.rate ?? null)}</div>
        <div className={styles.tileSub}>
          Last {ROLLING_DAYS} days
          {latest?.finished ? ` · ${latest.succeeded} of ${latest.finished} runs succeeded` : ''}
        </div>
      </Box>
      <div className={styles.tileSub}>
        Each point is the share of runs that succeeded in the {ROLLING_DAYS} days ending on that
        day, so one bad run nudges the line instead of dropping it to zero.
      </div>
      <div className={styles.plot}>
        <div className={styles.gridline}>
          <span className={styles.gridLabel}>100%</span>
        </div>
        <div className={styles.gridline} style={{top: '50%'}}>
          <span className={styles.gridLabel}>50%</span>
        </div>
        <svg
          className={styles.trendSvg}
          viewBox={`0 0 100 ${TREND_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <path
            d={path}
            fill="none"
            stroke={Colors.dataVizGreen()}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {days.map((day) => (
          <Tooltip
            key={day.date.toISOString()}
            content={
              <div>
                <strong>{day.date.toLocaleDateString()}</strong>:{' '}
                {day.finished
                  ? `${pct(day.rate)} · ${day.succeeded} of ${day.finished} runs succeeded in the ${ROLLING_DAYS} days ending here`
                  : `No finished runs in the ${ROLLING_DAYS} days ending here`}
              </div>
            }
          >
            <div className={styles.column}>
              {day.rate !== null ? (
                <span
                  className={styles.point}
                  style={{
                    top: `${(1 - day.rate) * 100}%`,
                    background: Colors.dataVizGreen(),
                  }}
                />
              ) : null}
            </div>
          </Tooltip>
        ))}
      </div>
      <div className={styles.xLabels}>
        {days.map((day, i) => (
          <div key={day.date.toISOString()} className={styles.xLabel}>
            {(TREND_DAYS - 1 - i) % 7 === 0
              ? day.date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
              : ''}
          </div>
        ))}
      </div>
    </>
  );
};

const RunBreakdown = ({
  run,
  stats,
  isLatest,
  onShowLatest,
}: {
  run: Run;
  stats: RunStats | null;
  isLatest: boolean;
  onShowLatest: () => void;
}) => {
  const {data, loading} = useQuery<
    HillpointeRunStepStatsQuery,
    HillpointeRunStepStatsQueryVariables
  >(HILLPOINTE_RUN_STEP_STATS_QUERY, {variables: {runId: run.runId}});

  const steps = useMemo(() => {
    const stats = data?.runOrError.__typename === 'Run' ? data.runOrError.stepStats : [];
    return stats
      .map((s) => ({...s, duration: durationSec(s.startTime, s.endTime)}))
      .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
  }, [data]);
  const max = Math.max(1, ...steps.map((s) => s.duration ?? 0));
  const stepStatuses = Object.entries(STEP_COLOR).map(([status, color]) => ({
    label: status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' '),
    color,
  }));

  return (
    <div className={styles.card}>
      <Box flex={{alignItems: 'center', gap: 12, wrap: 'wrap'}}>
        <div className={styles.cardTitle}>
          Run breakdown
          <span className={styles.cardSub}>
            <Link to={`/runs/${run.runId}`}>{run.runId.slice(0, 8)}</Link> · {run.jobName}
          </span>
        </div>
        <RunStatusTag status={run.status} />
        {isLatest ? (
          <Tag icon="history">Latest run</Tag>
        ) : (
          <>
            <Tag icon="history">Selected run</Tag>
            <Button onClick={onShowLatest}>Show latest run</Button>
          </>
        )}
      </Box>
      <div className={styles.tiles}>
        <Tile label="Duration" value={formatDuration(durationSec(run.startTime, run.endTime))} />
        <Tile label="Steps succeeded" value={`${stats?.stepsSucceeded ?? '—'}`} />
        <Tile label="Steps failed" value={`${stats?.stepsFailed ?? '—'}`} />
        <Tile label="Materializations" value={`${stats?.materializations ?? '—'}`} />
      </div>
      <div className={styles.cardTitle}>
        Step durations<span className={styles.cardSub}>Longest first</span>
      </div>
      <Legend items={stepStatuses} />
      {loading && !data ? (
        <Spinner purpose="section" />
      ) : steps.length ? (
        <div className={styles.stepRows}>
          {steps.map((step) => (
            <div key={step.stepKey} className={styles.stepRow}>
              <div className={styles.stepName} title={step.stepKey}>
                {step.stepKey}
              </div>
              <div className={styles.stepTrack}>
                <div
                  className={styles.stepBar}
                  style={{
                    width: `${((step.duration ?? 0) / max) * 100}%`,
                    background: step.status ? STEP_COLOR[step.status] : Colors.dataVizGray(),
                  }}
                />
              </div>
              <div className={styles.stepValue}>{formatDuration(step.duration)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.muted}>No steps have started for this run.</div>
      )}
    </div>
  );
};

interface SelectableProps {
  runs: Run[];
  statsByRun: StatsByRun;
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

const RunsTable = ({runs, statsByRun, selectedRunId, onSelect}: SelectableProps) => (
  <div className={styles.card}>
    <div className={styles.cardTitle}>
      Runs this month
      <span className={styles.cardSub}>
        Latest {Math.min(TABLE_ROWS, runs.length)} of {runs.length} · click a row to inspect it
        above
      </span>
    </div>
    <div className={styles.tableWrap}>
      <Table>
        <thead>
          <tr>
            <th>Run</th>
            <th>Job</th>
            <th>Status</th>
            <th>Created</th>
            <th>Duration</th>
            <th>Steps ok / failed</th>
            <th>Materializations</th>
          </tr>
        </thead>
        <tbody>
          {runs.slice(0, TABLE_ROWS).map((run) => {
            const stats = statsByRun?.get(run.runId) ?? null;
            return (
              <tr
                key={run.runId}
                className={clsx(styles.runRow, run.runId === selectedRunId && styles.selected)}
                onClick={() => onSelect(run.runId)}
              >
                <td>
                  <Link to={`/runs/${run.runId}`} onClick={(e) => e.stopPropagation()}>
                    {run.runId.slice(0, 8)}
                  </Link>
                </td>
                <td>{run.jobName}</td>
                <td>
                  <RunStatusTag status={run.status} />
                </td>
                <td>{new Date(run.creationTime * 1000).toLocaleString()}</td>
                <td>{formatDuration(durationSec(run.startTime, run.endTime))}</td>
                <td>
                  {stats
                    ? `${stats.stepsSucceeded} / ${stats.stepsFailed}`
                    : statsByRun
                      ? '—'
                      : '…'}
                </td>
                <td>{stats ? stats.materializations : statsByRun ? '—' : '…'}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  </div>
);

export const HILLPOINTE_RUN_METRICS_QUERY = gql`
  query HillpointeRunMetricsQuery($after: Float!, $limit: Int!) {
    runsOrError(filter: {createdAfter: $after}, limit: $limit) {
      ... on Runs {
        results {
          id
          runId
          jobName
          status
          creationTime
          startTime
          endTime
        }
      }
    }
  }
`;

// Per-run stats come from the event log and are slow for a whole month of
// runs, so they load separately and fill in after the page has rendered.
export const HILLPOINTE_RUN_STATS_QUERY = gql`
  query HillpointeRunStatsQuery($after: Float!, $limit: Int!) {
    runsOrError(filter: {createdAfter: $after}, limit: $limit) {
      ... on Runs {
        results {
          id
          runId
          stats {
            ... on RunStatsSnapshot {
              id
              stepsSucceeded
              stepsFailed
              materializations
            }
          }
        }
      }
    }
  }
`;

export const HILLPOINTE_RUN_HISTORY_QUERY = gql`
  query HillpointeRunHistoryQuery($after: Float!) {
    runsOrError(filter: {createdAfter: $after}, limit: 5000) {
      ... on Runs {
        results {
          id
          status
          creationTime
        }
      }
    }
  }
`;

export const HILLPOINTE_ROW_COUNT_QUERY = gql`
  query HillpointeRowCountQuery($after: Float!) {
    runsOrError(filter: {createdAfter: $after}, limit: 1000) {
      ... on Runs {
        results {
          id
          startTime
          assetMaterializations {
            metadataEntries {
              label
              ... on IntMetadataEntry {
                intRepr
              }
            }
          }
        }
      }
    }
  }
`;

export const HILLPOINTE_RUN_STEP_STATS_QUERY = gql`
  query HillpointeRunStepStatsQuery($runId: ID!) {
    runOrError(runId: $runId) {
      ... on Run {
        id
        stepStats {
          stepKey
          status
          startTime
          endTime
        }
      }
    }
  }
`;

// Imported via React.lazy, which requires a default export.
// eslint-disable-next-line import/no-default-export
export default HillpointeRoot;
