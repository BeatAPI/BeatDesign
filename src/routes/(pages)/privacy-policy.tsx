import { createFileRoute } from '@tanstack/react-router';

import { staticPageRouteOptions } from './-static-page';

export const Route = createFileRoute('/(pages)/privacy-policy')(
  staticPageRouteOptions('privacy-policy')
);
