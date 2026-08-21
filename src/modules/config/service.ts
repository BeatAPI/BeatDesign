import { eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { config } from '@/config/db/schema';
import { encryptSecret, decryptSecret, isEncryptedSecret } from '@/lib/crypto';

export type ConfigMap = Record<string, string>;

// In-memory cache
let cachedConfigs: ConfigMap | null = null;
let cacheTime = 0;
const CACHE_TTL = 3600_000; // 1 hour

/**
 * Get all configs from database.
 */
export async function getDbConfigs(): Promise<ConfigMap> {
  const now = Date.now();
  if (cachedConfigs && now - cacheTime < CACHE_TTL) {
    return cachedConfigs;
  }

  try {
    const rows = await db().select().from(config);
    const result: ConfigMap = {};
    for (const row of rows) {
      if (!row.name || !row.value) continue;

      if (isEncryptedSecret(row.value)) {
        const plain = await decryptSecret(row.value);
        if (plain === null) {
          // Wrong/rotated encryption key — skip so env value (if any) applies.
          console.warn(`[config] failed to decrypt "${row.name}", skipping`);
          continue;
        }
        result[row.name] = plain;
      } else if (isSecretConfigKey(row.name)) {
        const encrypted = await encryptSecret(row.value);
        await db()
          .update(config)
          .set({ value: encrypted })
          .where(eq(config.name, row.name));
        result[row.name] = row.value;
      } else {
        result[row.name] = row.value;
      }
    }

    cachedConfigs = result;
    cacheTime = now;
    return result;
  } catch {
    return {};
  }
}

/**
 * Get all workspace configs. Environment fallbacks are resolved per key.
 */
export async function getAllConfigs(): Promise<ConfigMap> {
  return getDbConfigs();
}

/** Provider settings writable from the local workspace dialog. */
const WRITABLE_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'BEATAPI_API_BASE_URL',
  'BEATAPI_API_KEY',
  'WORKSPACE_STORAGE_MODE',
  'R2_REGION',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'R2_FORCE_PATH_STYLE',
]);

/**
 * Provider secrets are always encrypted at rest. Local SQLite mode generates
 * a per-install key; hosted modes require CONFIG_ENCRYPTION_KEY.
 */
const SECRET_KEY_PATTERN =
  /(_secret|_secret_key|_token|_password|_private_key|_api_key|_access_key|_access_key_id|_api_v3_key)$/;

export function isSecretConfigKey(name: string): boolean {
  return SECRET_KEY_PATTERN.test(name.toLowerCase());
}

/** Mask marker — secrets never start with bullets, so it's unambiguous. */
const MASK_PREFIX = '••••••••';

/**
 * Mask a secret for display: keep the last 4 chars when long enough to be
 * unidentifiable from them, otherwise mask entirely.
 */
export function maskConfigValue(value: string): string {
  return value.length > 8 ? MASK_PREFIX + value.slice(-4) : MASK_PREFIX;
}

/** A masked value round-tripped from the admin UI means "unchanged". */
export function isMaskedConfigValue(value: string): boolean {
  return value.startsWith(MASK_PREFIX);
}

/**
 * Save provider configs to the local database. Masked values mean unchanged.
 */
export async function saveConfigs(configs: ConfigMap) {
  const entries = await Promise.all(
    Object.entries(configs)
      .filter(([name, value]) => WRITABLE_CONFIG_KEYS.has(name) && !isMaskedConfigValue(value))
      .map(async ([name, value]): Promise<[string, string]> =>
        isSecretConfigKey(name) ? [name, await encryptSecret(value)] : [name, value]
      )
  );
  if (entries.length === 0) {
    return;
  }

  await db().transaction(async (tx: any) => {
    for (const [name, value] of entries) {
      const [existing] = await tx
        .select()
        .from(config)
        .where(eq(config.name, name))
        .limit(1);

      if (existing) {
        await tx.update(config).set({ value }).where(eq(config.name, name));
      } else {
        await tx.insert(config).values({ name, value });
      }
    }
  });

  // Invalidate cache
  cachedConfigs = null;
  cacheTime = 0;
}

/**
 * Get a single config value.
 */
export async function getConfig(name: string): Promise<string | undefined> {
  const configs = await getDbConfigs();
  return configs[name] || process.env[name] || undefined;
}
