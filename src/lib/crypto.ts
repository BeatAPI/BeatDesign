/**
 * AES-256-GCM encryption for provider secrets stored in the local database.
 *
 * Built on Web Crypto (crypto.subtle), available in the supported local Node runtime.
 *
 * Encrypted values are self-describing: `enc:v1:<base64(iv | authTag | ciphertext)>`.
 * Plain values (no prefix) pass through decryptSecret unchanged so the config
 * service can migrate legacy rows after a verified encrypted write.
 *
 * A per-install key is created at data/.workspace-key.
 *
 * This protects against database-only compromise. It does not protect against
 * a fully compromised local machine that can read both files.
 */

const ENC_PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const LOCAL_KEY_FILENAME = '.workspace-key';

let cachedEncryptionSecret: string | undefined;

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
  if (cachedEncryptionSecret) return cachedEncryptionSecret;
  if (typeof process.getBuiltinModule !== 'function') return undefined;

  const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs');
  const path = process.getBuiltinModule('node:path') as typeof import('node:path');
  const configuredDataRoot = process.env.BEATDESIGN_DATA_DIR?.trim();
  const keyPath = path.resolve(
    configuredDataRoot || 'data',
    LOCAL_KEY_FILENAME
  );
  fs.mkdirSync(path.dirname(keyPath), { recursive: true, mode: 0o700 });

  try {
    cachedEncryptionSecret = fs.readFileSync(keyPath, 'utf8').trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const generated = toBase64(crypto.getRandomValues(new Uint8Array(32)));
    try {
      fs.writeFileSync(keyPath, `${generated}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      cachedEncryptionSecret = generated;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw writeError;
      }
      cachedEncryptionSecret = fs.readFileSync(keyPath, 'utf8').trim();
    }
  }

  if (!cachedEncryptionSecret) {
    throw new Error('Local secret encryption key is empty');
  }
  return cachedEncryptionSecret;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/**
 * Encrypt a secret for storage. Secret persistence never falls back to
 * plaintext when an encryption key is unavailable.
 */
export async function encryptSecret(plain: string): Promise<string> {
  if (!plain || isEncryptedSecret(plain)) return plain;

  const secret = getEncryptionSecret();
  if (!secret) {
    throw new Error('Local secret encryption is unavailable.');
  }

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
 * (wrong/rotated/missing encryption key) — callers should skip such values.
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
