/**
 * AES-256-GCM encryption for provider secrets stored in the local database.
 *
 * Built on Web Crypto (crypto.subtle) — works natively on Node 18+, Cloudflare
 * Workers, and Edge runtimes with no nodejs_compat requirements.
 *
 * Encrypted values are self-describing: `enc:v1:<base64(iv | authTag | ciphertext)>`.
 * Plain values (no prefix) pass through decryptSecret unchanged, so legacy
 * plaintext rows keep working and get encrypted on their next save.
 *
 * Key source: CONFIG_ENCRYPTION_KEY env var. When unset, encryption is
 * disabled entirely — values are stored as plaintext (the original behavior).
 * Already-encrypted rows still decrypt as long as the key stays configured.
 *
 * This protects against database-only compromise (leaked backups, SQL
 * injection dumps). It does NOT protect against a compromised app server —
 * the key lives in env on the same machine.
 */

const ENC_PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Return type inferred as Uint8Array<ArrayBuffer> — required for BufferSource params.
function fromBase64(value: string) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function getEncryptionSecret(): string | undefined {
  return process.env.CONFIG_ENCRYPTION_KEY || undefined;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/**
 * Encrypt a secret for storage. Returns the value unchanged (plaintext) when
 * it's empty, already encrypted, or CONFIG_ENCRYPTION_KEY is not configured.
 */
export async function encryptSecret(plain: string): Promise<string> {
  if (!plain || isEncryptedSecret(plain)) return plain;

  const secret = getEncryptionSecret();
  if (!secret) return plain;

  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // Web Crypto returns ciphertext with the GCM tag appended at the end.
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  );
  const ciphertext = sealed.subarray(0, sealed.length - TAG_LENGTH);
  const tag = sealed.subarray(sealed.length - TAG_LENGTH);

  const packed = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  packed.set(iv, 0);
  packed.set(tag, IV_LENGTH);
  packed.set(ciphertext, IV_LENGTH + TAG_LENGTH);

  return ENC_PREFIX + toBase64(packed);
}

/**
 * Decrypt a stored value. Plain (non-prefixed) values pass through unchanged.
 * Returns null when the value is encrypted but cannot be decrypted
 * (wrong/rotated/missing CONFIG_ENCRYPTION_KEY) — callers should skip such values.
 */
export async function decryptSecret(value: string): Promise<string | null> {
  if (!isEncryptedSecret(value)) return value;

  const secret = getEncryptionSecret();
  if (!secret) return null;

  try {
    const packed = fromBase64(value.slice(ENC_PREFIX.length));
    if (packed.length <= IV_LENGTH + TAG_LENGTH) return null;

    const iv = packed.subarray(0, IV_LENGTH);
    const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

    // Reassemble ciphertext||tag for Web Crypto.
    const sealed = new Uint8Array(ciphertext.length + TAG_LENGTH);
    sealed.set(ciphertext, 0);
    sealed.set(tag, ciphertext.length);

    const key = await deriveKey(secret);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
