import {Box, Heading, NonIdealState, PageHeader} from '@dagster-io/ui-components';

import {useTrackPageView} from '../app/analytics';
import {useDocumentTitle} from '../hooks/useDocumentTitle';

export const HillpointeRoot = () => {
  useTrackPageView();
  useDocumentTitle('Hillpointe');

  return (
    <Box flex={{direction: 'column'}} style={{height: '100%', overflow: 'hidden'}}>
      <PageHeader
        title={
          <Heading size={16} weight={600}>
            Hillpointe
          </Heading>
        }
      />
      <Box padding={64}>
        <NonIdealState
          icon="home"
          title="Hillpointe"
          description="Placeholder page. Add Hillpointe content here."
        />
      </Box>
    </Box>
  );
};

// Imported via React.lazy, which requires a default export.
// eslint-disable-next-line import/no-default-export
export default HillpointeRoot;
