import {Button, Icon, NonIdealState, Spinner} from '@dagster-io/ui-components';
import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';

import {gql, useQuery} from '../../apollo-client';
import {formatElapsedTimeWithoutMsec} from '../Util';
import styles from './css/Mobile.module.css';
import {MobileRecentRunsQuery, MobileRecentRunsQueryVariables} from './types/MobilePipelines.types';
import {isHiddenAssetGroupJob} from '../../asset-graph/Utils';
import {useDocumentTitle} from '../../hooks/useDocumentTitle';
import {RunStatusTag} from '../../runs/RunStatusTag';
import {TimeElapsed} from '../../runs/TimeElapsed';
import {useLaunchWithTelemetry} from '../../shared/launchpad/useLaunchWithTelemetry';
import {TimeFromNow} from '../../ui/TimeFromNow';
import {useRepositoryOptions} from '../../workspace/WorkspaceContext/util';
import {FIFTEEN_SECONDS, useQueryRefreshAtInterval} from '../QueryRefresh';

const RECENT_RUN_LIMIT = 300;

type Job = {name: string; repositoryName: string; repositoryLocationName: string};
type Run = Extract<MobileRecentRunsQuery['runsOrError'], {__typename: 'Runs'}>['results'][number];

const jobKey = (j: Job) => `${j.repositoryLocationName}:${j.repositoryName}:${j.name}`;

// eslint-disable-next-line import/no-default-export
export default function MobilePipelines() {
  useDocumentTitle('Pipelines');
  const {options, loading: loadingJobs} = useRepositoryOptions();

  const jobs: Job[] = useMemo(
    () =>
      options.flatMap((o) =>
        o.repository.pipelines
          .filter((p) => p.isJob && !isHiddenAssetGroupJob(p.name))
          .map((p) => ({
            name: p.name,
            repositoryName: o.repository.name,
            repositoryLocationName: o.repositoryLocation.name,
          })),
      ),
    [options],
  );

  const queryResult = useQuery<MobileRecentRunsQuery, MobileRecentRunsQueryVariables>(
    MOBILE_RECENT_RUNS_QUERY,
    {variables: {limit: RECENT_RUN_LIMIT}},
  );
  useQueryRefreshAtInterval(queryResult, FIFTEEN_SECONDS);

  // Runs come back newest first, so the first one seen per job is its latest.
  const latestByJob = useMemo(() => {
    const map = new Map<string, Run>();
    const result = queryResult.data?.runsOrError;
    if (result?.__typename === 'Runs') {
      result.results.forEach((run) => {
        const origin = run.repositoryOrigin;
        const key = origin
          ? `${origin.repositoryLocationName}:${origin.repositoryName}:${run.pipelineName}`
          : run.pipelineName;
        if (!map.has(key)) {
          map.set(key, run);
        }
      });
    }
    return map;
  }, [queryResult.data]);

  if (loadingJobs && !jobs.length) {
    return (
      <div className={styles.center}>
        <Spinner purpose="page" />
      </div>
    );
  }
  if (!jobs.length) {
    return <NonIdealState icon="job" title="No pipelines" description="No jobs are loaded." />;
  }

  return (
    <div className={styles.list}>
      {jobs.map((job) => (
        <PipelineCard
          key={jobKey(job)}
          job={job}
          latest={latestByJob.get(jobKey(job)) ?? latestByJob.get(job.name) ?? null}
          onLaunched={() => queryResult.refetch()}
        />
      ))}
    </div>
  );
}

const PipelineCard = ({
  job,
  latest,
  onLaunched,
}: {
  job: Job;
  latest: Run | null;
  onLaunched: () => void;
}) => {
  const launch = useLaunchWithTelemetry();
  const [launching, setLaunching] = useState(false);

  const onRun = async () => {
    setLaunching(true);
    try {
      await launch(
        {
          executionParams: {
            selector: {
              repositoryLocationName: job.repositoryLocationName,
              repositoryName: job.repositoryName,
              jobName: job.name,
            },
            runConfigData: {},
            mode: 'default',
          },
        },
        {behavior: 'toast'},
      );
      onLaunched();
    } finally {
      setLaunching(false);
    }
  };

  const duration =
    latest?.startTime && latest.endTime
      ? formatElapsedTimeWithoutMsec((latest.endTime - latest.startTime) * 1000)
      : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardName}>{job.name}</div>
        {latest ? (
          <Link to={`/runs/${latest.id}`} className={styles.cardStatus}>
            <RunStatusTag status={latest.status} />
            {latest.startTime ? (
              <span className={styles.cardMeta}>
                <TimeFromNow unixTimestamp={latest.startTime} />
                {duration ? ` · ${duration}` : ''}
                {!latest.endTime ? (
                  <span className={styles.live}>
                    · <TimeElapsed startUnix={latest.startTime} endUnix={null} />
                  </span>
                ) : null}
              </span>
            ) : null}
          </Link>
        ) : (
          <span className={styles.cardMeta}>Never run</span>
        )}
      </div>
      <Button
        intent="primary"
        icon={<Icon name="execute" />}
        loading={launching}
        onClick={onRun}
        className={styles.runButton}
      >
        Run
      </Button>
    </div>
  );
};

export const MOBILE_RECENT_RUNS_QUERY = gql`
  query MobileRecentRunsQuery($limit: Int!) {
    runsOrError(limit: $limit) {
      ... on Runs {
        results {
          id
          runId
          status
          pipelineName
          startTime
          endTime
          repositoryOrigin {
            id
            repositoryName
            repositoryLocationName
          }
        }
      }
    }
  }
`;
