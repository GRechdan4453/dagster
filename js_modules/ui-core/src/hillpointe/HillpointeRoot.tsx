import {
  Box,
  Button,
  Colors,
  Heading,
  Icon,
  NonIdealState,
  PageHeader,
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
import {RunStatusTag} from '../runs/RunStatusTag';

const RUN_LIMIT = 100;
const DAYS = 14;
const HISTORY_DAYS = 90;

type Run = Extract<
  HillpointeRunMetricsQuery['runsOrError'],
  {__typename: 'Runs'}
>['results'][number];

// Status buckets. Colours are theme tokens, so every chart follows the selected theme.
type Bucket = 'success' | 'failure' | 'canceled' | 'inProgress' | 'queued';

const BUCKETS: {key: Bucket; label: string; color: string}[] = [
  {key: 'success', label: 'Succeeded', color: Colors.accentGreen()},
  {key: 'failure', label: 'Failed', color: Colors.accentRed()},
  {key: 'canceled', label: 'Canceled', color: Colors.accentGray()},
  {key: 'inProgress', label: 'In progress', color: Colors.accentBlue()},
  {key: 'queued', label: 'Queued', color: Colors.accentYellow()},
];

const BUCKET_COLOR = Object.fromEntries(BUCKETS.map((b) => [b.key, b.color])) as Record<
  Bucket,
  string
>;

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
  [StepEventStatus.SUCCESS]: Colors.accentGreen(),
  [StepEventStatus.FAILURE]: Colors.accentRed(),
  [StepEventStatus.SKIPPED]: Colors.accentGray(),
  [StepEventStatus.IN_PROGRESS]: Colors.accentBlue(),
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

  const queryResult = useQuery<HillpointeRunMetricsQuery, HillpointeRunMetricsQueryVariables>(
    HILLPOINTE_RUN_METRICS_QUERY,
    {variables: {limit: RUN_LIMIT}},
  );
  const refreshState = useQueryRefreshAtInterval(queryResult, FIFTEEN_SECONDS);
  const {data, loading} = queryResult;
  const runs = useMemo(
    () => (data?.runsOrError.__typename === 'Runs' ? data.runsOrError.results : []),
    [data],
  );

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
        <SummaryTiles runs={runs} />
        <div className={styles.chartGrid}>
          <RunsPerDayChart runs={runs} />
          <RunStatusBlock />
        </div>
        {selectedRun ? (
          <RunBreakdown
            run={selectedRun}
            isLatest={selectedRun === runs[0]}
            onShowLatest={() => setSelectedRunId(null)}
          />
        ) : null}
        <RunsTable
          runs={runs}
          selectedRunId={selectedRun?.runId ?? null}
          onSelect={setSelectedRunId}
        />
      </div>
    );
  };

  return (
    <Box flex={{direction: 'column'}} style={{height: '100%', overflow: 'hidden'}}>
      <PageHeader
        title={
          <Heading size={16} weight={600}>
            Hillpointe
          </Heading>
        }
        right={<QueryRefreshCountdown refreshState={refreshState} />}
      />
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

const SummaryTiles = ({runs}: {runs: Run[]}) => {
  const counts = {success: 0, failure: 0, canceled: 0, inProgress: 0, queued: 0};
  runs.forEach((r) => counts[bucketFor(r.status)]++);
  const finished = counts.success + counts.failure + counts.canceled;
  const durations = runs
    .filter((r) => r.endTime)
    .map((r) => durationSec(r.startTime, r.endTime))
    .filter((d): d is number => d !== null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const materializations = runs.reduce(
    (sum, r) => sum + (r.stats.__typename === 'RunStatsSnapshot' ? r.stats.materializations : 0),
    0,
  );

  return (
    <div className={styles.tiles}>
      <Tile label="Runs" value={`${runs.length}`} sub={`Most recent ${RUN_LIMIT}`} />
      <Tile
        label="Success rate"
        value={finished ? `${Math.round((counts.success / finished) * 100)}%` : '—'}
        sub={`${counts.success} of ${finished} finished`}
      />
      <Tile label="Failed" value={`${counts.failure}`} sub={`${counts.canceled} canceled`} />
      <Tile label="Avg duration" value={formatDuration(avg)} sub="Finished runs" />
      <Tile
        label="Active"
        value={`${counts.inProgress + counts.queued}`}
        sub={`${counts.inProgress} running, ${counts.queued} queued`}
      />
      <Tile label="Materializations" value={`${materializations}`} sub="Across these runs" />
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
const ROW_COUNT_LABEL = 'dagster/row_count';

/** Colour for one day: any failure wins, then unfinished runs, then success. */
const dayColor = (counts: Partial<Record<Bucket, number>>) => {
  if (counts.failure) {
    return BUCKET_COLOR.failure;
  }
  if (counts.inProgress || counts.queued) {
    return BUCKET_COLOR.inProgress;
  }
  if (counts.success) {
    return BUCKET_COLOR.success;
  }
  return counts.canceled ? BUCKET_COLOR.canceled : EMPTY_DAY;
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

  // Sum of dagster/row_count over materializations, split by the day they happened.
  const rowCounts = useMemo(() => {
    const result = rowCountResult.data?.runsOrError;
    const totals = {yesterday: 0, today: 0};
    const todayStart = startOfDay(0).getTime();
    (result?.__typename === 'Runs' ? result.results : []).forEach((run) =>
      run.assetMaterializations.forEach((m) => {
        const entry = m.metadataEntries.find(
          (e) => e.__typename === 'IntMetadataEntry' && e.label === ROW_COUNT_LABEL,
        );
        const value = entry?.__typename === 'IntMetadataEntry' ? Number(entry.intRepr) : 0;
        const ts = Number(m.timestamp);
        if (ts >= todayStart) {
          totals.today += value;
        } else if (ts >= yesterdayStart.getTime()) {
          totals.yesterday += value;
        }
      }),
    );
    return totals;
  }, [rowCountResult.data, yesterdayStart]);

  const today = days[days.length - 1];
  const todayFinished = today
    ? (today.counts.success ?? 0) + (today.counts.failure ?? 0) + (today.counts.canceled ?? 0)
    : 0;
  const todayRunning = (today?.total ?? 0) - todayFinished;
  // Runs arrive newest first.
  const latest = runs[0];

  return (
    <div className={styles.card}>
      <div className={styles.jobHeader}>
        <div className={styles.jobTitle}>
          <span
            className={styles.dot}
            style={{background: latest ? BUCKET_COLOR[bucketFor(latest.status)] : EMPTY_DAY}}
          />
          Pipeline runs
          <Tooltip content="Each tick is one day. Red: at least one run failed. Blue: runs still going. Green: every run succeeded. Empty: no runs. Row counts add up the dagster/row_count metadata on materializations.">
            <Icon name="info" color={Colors.textLighter()} />
          </Tooltip>
        </div>
        <div className={styles.jobStats}>
          <div>
            <div className={styles.tileLabel}>Row count yesterday</div>
            <div className={styles.jobStatValue}>{rowCounts.yesterday.toLocaleString()}</div>
          </div>
          <div>
            <div className={styles.tileLabel}>Row count today</div>
            <div className={styles.jobStatValue}>{rowCounts.today.toLocaleString()}</div>
          </div>
        </div>
      </div>
      <div className={styles.jobToday}>
        Today&apos;s status:{' '}
        {today?.total ? (
          <span
            style={{
              color: today.counts.failure ? Colors.textRed() : Colors.textGreen(),
              fontWeight: 600,
            }}
          >
            {today.counts.success ?? 0}/{todayFinished} runs successful
            {todayRunning ? `, ${todayRunning} still running` : ''}
          </span>
        ) : (
          <span className={styles.muted}>No runs today</span>
        )}
      </div>
      <div className={styles.tickSection}>
        <div className={styles.tickTitle}>Run status:</div>
        <div className={styles.ticks}>
          {days.map((day) => (
            <Tooltip
              key={day.date.toISOString()}
              content={
                <div>
                  <strong>{day.date.toLocaleDateString()}</strong>:{' '}
                  {day.total ? `${day.total} runs` : 'No runs'}
                  {BUCKETS.filter((b) => day.counts[b.key]).map((b) => (
                    <div key={b.key}>
                      {b.label}: {day.counts[b.key]}
                    </div>
                  ))}
                </div>
              }
            >
              <div className={styles.tick} style={{background: dayColor(day.counts)}} />
            </Tooltip>
          ))}
        </div>
        <div className={styles.tickAxis}>
          <span>{HISTORY_DAYS - 1} days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
};

const RunsPerDayChart = ({runs}: {runs: Run[]}) => {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = Array.from({length: DAYS}, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (DAYS - 1 - i));
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
  }, [runs]);
  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        Runs per day<span className={styles.cardSub}>Last {DAYS} days</span>
      </div>
      <Legend items={BUCKETS} />
      <div className={styles.plot}>
        <div className={styles.gridline}>
          <span className={styles.gridLabel}>{max}</span>
        </div>
        {days.map((day) => (
          <Tooltip
            key={day.date.toISOString()}
            content={
              <div>
                <strong>{day.date.toLocaleDateString()}</strong>: {day.total} runs
                {BUCKETS.filter((b) => day.counts[b.key]).map((b) => (
                  <div key={b.key}>
                    {b.label}: {day.counts[b.key]}
                  </div>
                ))}
              </div>
            }
          >
            <div className={styles.column}>
              {BUCKETS.filter((b) => day.counts[b.key]).map((b) => (
                <div
                  key={b.key}
                  className={styles.segment}
                  style={{
                    height: `${((day.counts[b.key] ?? 0) / max) * 100}%`,
                    background: b.color,
                  }}
                />
              ))}
            </div>
          </Tooltip>
        ))}
      </div>
      <div className={styles.xLabels}>
        {days.map((day, i) => (
          <div key={day.date.toISOString()} className={styles.xLabel}>
            {(DAYS - 1 - i) % 2 === 0 ? day.date.getDate() : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

interface SelectableProps {
  runs: Run[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

const RunBreakdown = ({
  run,
  isLatest,
  onShowLatest,
}: {
  run: Run;
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
  const stats = run.stats.__typename === 'RunStatsSnapshot' ? run.stats : null;
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
                    background: step.status ? STEP_COLOR[step.status] : Colors.accentGray(),
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

const RunsTable = ({runs, selectedRunId, onSelect}: SelectableProps) => (
  <div className={styles.card}>
    <div className={styles.cardTitle}>
      All runs<span className={styles.cardSub}>Click a row to inspect it above</span>
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
          {runs.map((run) => {
            const stats = run.stats.__typename === 'RunStatsSnapshot' ? run.stats : null;
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
                <td>{stats ? `${stats.stepsSucceeded} / ${stats.stepsFailed}` : '—'}</td>
                <td>{stats?.materializations ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  </div>
);

export const HILLPOINTE_RUN_METRICS_QUERY = gql`
  query HillpointeRunMetricsQuery($limit: Int!) {
    runsOrError(limit: $limit) {
      ... on Runs {
        results {
          id
          runId
          jobName
          status
          creationTime
          startTime
          endTime
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
          assetMaterializations {
            timestamp
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
