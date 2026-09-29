/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]};
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never};
// Generated GraphQL types, do not edit manually.

import * as Types from '../../graphql/types';

export type RunStatus =
  | 'CANCELED'
  | 'CANCELING'
  | 'FAILURE'
  | 'MANAGED'
  | 'NOT_STARTED'
  | 'QUEUED'
  | 'STARTED'
  | 'STARTING'
  | 'SUCCESS';

export type StepEventStatus = 'FAILURE' | 'IN_PROGRESS' | 'SKIPPED' | 'SUCCESS';

export type HillpointeRunMetricsQueryVariables = Exact<{
  limit: number;
}>;

export type HillpointeRunMetricsQuery = {
  __typename: 'Query';
  runsOrError:
    | {__typename: 'InvalidPipelineRunsFilterError'}
    | {__typename: 'PythonError'}
    | {
        __typename: 'Runs';
        results: Array<{
          __typename: 'Run';
          id: string;
          runId: string;
          jobName: string;
          status: Types.RunStatus;
          creationTime: number;
          startTime: number | null;
          endTime: number | null;
          stats:
            | {__typename: 'PythonError'}
            | {
                __typename: 'RunStatsSnapshot';
                id: string;
                stepsSucceeded: number;
                stepsFailed: number;
                materializations: number;
              };
        }>;
      };
};

export type HillpointeRunStepStatsQueryVariables = Exact<{
  runId: string;
}>;

export type HillpointeRunStepStatsQuery = {
  __typename: 'Query';
  runOrError:
    | {__typename: 'PythonError'}
    | {
        __typename: 'Run';
        id: string;
        stepStats: Array<{
          __typename: 'RunStepStats';
          stepKey: string;
          status: Types.StepEventStatus | null;
          startTime: number | null;
          endTime: number | null;
        }>;
      }
    | {__typename: 'RunNotFoundError'};
};
