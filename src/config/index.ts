/** Fixed product configuration for the local BeatDesign workbench. */
export const appConfig = {
  app_url: 'http://127.0.0.1:3020',
  app_name: 'BeatDesign',
  app_description:
    'The open-source, local-first AI canvas for image and video creation.',
  app_logo: '/logo.png',
  database_url: 'file:data/local.db',
} as const;
