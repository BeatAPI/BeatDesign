const metaEnv: Record<string, string | undefined> =
  (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const procEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

const publicEnv = (key: string) => metaEnv[key] ?? procEnv[key];

export const envConfigs: Record<string, string> = {
  app_url: publicEnv('VITE_APP_URL') ?? 'http://localhost:3020',
  app_name: publicEnv('VITE_APP_NAME') ?? 'BeatDesign',
  app_description:
    publicEnv('VITE_APP_DESCRIPTION') ??
    'The open-source, local-first AI canvas for image and video creation.',
  app_logo: publicEnv('VITE_APP_LOGO') ?? '/logo.png',
  generation_provider:
    procEnv.GENERATION_PROVIDER ??
    publicEnv('VITE_GENERATION_PROVIDER') ??
    'beatapi',

  database_provider: procEnv.DATABASE_PROVIDER ?? 'sqlite',
  database_url: procEnv.DATABASE_URL ?? 'file:data/workspace.db',
  database_auth_token: procEnv.DATABASE_AUTH_TOKEN ?? '',
  db_schema: procEnv.DB_SCHEMA ?? 'main',
  db_singleton_enabled: procEnv.DB_SINGLETON_ENABLED ?? 'true',
  db_max_connections: procEnv.DB_MAX_CONNECTIONS ?? '1',

  workspace_storage_mode: procEnv.WORKSPACE_STORAGE_MODE ?? 'beatapi',
  beatapi_managed_r2_region: procEnv.BEATAPI_MANAGED_R2_REGION ?? 'auto',
  beatapi_managed_r2_endpoint: procEnv.BEATAPI_MANAGED_R2_ENDPOINT ?? '',
  beatapi_managed_r2_access_key_id:
    procEnv.BEATAPI_MANAGED_R2_ACCESS_KEY_ID ?? '',
  beatapi_managed_r2_secret_access_key:
    procEnv.BEATAPI_MANAGED_R2_SECRET_ACCESS_KEY ?? '',
  beatapi_managed_r2_bucket_name:
    procEnv.BEATAPI_MANAGED_R2_BUCKET_NAME ?? '',
  beatapi_managed_r2_public_url:
    procEnv.BEATAPI_MANAGED_R2_PUBLIC_URL ?? '',
  beatapi_managed_r2_force_path_style:
    procEnv.BEATAPI_MANAGED_R2_FORCE_PATH_STYLE ?? 'true',
  r2_region: procEnv.R2_REGION ?? 'auto',
  r2_endpoint: procEnv.R2_ENDPOINT ?? '',
  r2_access_key_id: procEnv.R2_ACCESS_KEY_ID ?? '',
  r2_secret_access_key: procEnv.R2_SECRET_ACCESS_KEY ?? '',
  r2_image_bucket_name: procEnv.R2_IMAGE_BUCKET_NAME ?? '',
  r2_image_public_url: procEnv.R2_IMAGE_PUBLIC_URL ?? '',
  r2_video_bucket_name: procEnv.R2_VIDEO_BUCKET_NAME ?? '',
  r2_video_public_url: procEnv.R2_VIDEO_PUBLIC_URL ?? '',
  r2_bucket_name:
    procEnv.R2_BUCKET_NAME ??
    procEnv.R2_IMAGE_BUCKET_NAME ??
    procEnv.R2_VIDEO_BUCKET_NAME ??
    '',
  r2_public_url:
    procEnv.R2_PUBLIC_URL ??
    procEnv.R2_IMAGE_PUBLIC_URL ??
    procEnv.R2_VIDEO_PUBLIC_URL ??
    '',
  r2_force_path_style: procEnv.R2_FORCE_PATH_STYLE ?? 'true',
};
