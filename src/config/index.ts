/** Fixed product configuration for the local 16688 Studio workbench. */
export const appConfig = {
  app_url:
    import.meta.env?.VITE_APP_URL?.trim() || 'http://127.0.0.1:3020',
  app_name: '16688 Studio',
  app_description:
    'A local-first AI canvas for image, video, MCP, and agent workflows.',
  app_logo: '/16688-studio-logo.svg',
  database_url: 'file:data/local.db',
} as const;
