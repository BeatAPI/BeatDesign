import { envConfigs } from '@/config';
import type { StorageConfig } from '../types';

/**
 * Default storage configuration
 *
 * This configuration is loaded from environment variables
 */
export const storageConfig: StorageConfig = {
  region: envConfigs.r2_region || 'auto',
  endpoint: envConfigs.r2_endpoint || undefined,
  accessKeyId: envConfigs.r2_access_key_id || '',
  secretAccessKey: envConfigs.r2_secret_access_key || '',
  bucketName: envConfigs.r2_bucket_name || '',
  publicUrl: envConfigs.r2_public_url || undefined,
  forcePathStyle: envConfigs.r2_force_path_style !== 'false',
};
