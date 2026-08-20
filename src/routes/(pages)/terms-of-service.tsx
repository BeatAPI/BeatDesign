import { createFileRoute } from '@tanstack/react-router';

import { staticPageRouteOptions } from './-static-page';

export const Route = createFileRoute('/(pages)/terms-of-service')(
  staticPageRouteOptions('terms-of-service')
);
