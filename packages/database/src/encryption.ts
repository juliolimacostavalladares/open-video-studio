import crypto from 'crypto';

// AES-256-GCM configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = 'enc:';

// Generate a deterministic fallback key for development so it remains stable across process restarts
const DEV_FALLBACK_KEY = crypto.createHash('sha256').update('dev_secret_key_deterministic_fallback_seed_!!!').digest();

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    // Fail loudly in production or staging if the key is missing
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
      throw new Error('❌ Missing ENCRYPTION_KEY environment variable in production/staging mode!');
    }
    return DEV_FALLBACK_KEY;
  }

  // If env key is hex-encoded, parse it, otherwise hash it to ensure 32-byte key length
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }

  // fallback to a sha256 hash of the env string to ensure exactly 32 bytes
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Checks if a string starts with the designated encryption prefix
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  return text.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypts cleartext string using AES-256-GCM. Prevents double-encryption.
 */
export function encrypt(text: string): string {
  if (!text) return text;
  if (isEncrypted(text)) return text;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: enc:iv:encryptedData:authTag
  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Decrypts cipherText back into cleartext string
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return cipherText;

  if (!isEncrypted(cipherText)) {
    // Return as-is if it doesn't have the encryption prefix (helps migrating/supporting unencrypted data)
    return cipherText;
  }

  const rawCipher = cipherText.slice(ENCRYPTED_PREFIX.length);
  const parts = rawCipher.split(':');
  const ivPart = parts[0];
  const dataPart = parts[1];
  const tagPart = parts[2];

  if (parts.length !== 3 || !ivPart || !dataPart || !tagPart) {
    throw new Error('Invalid encrypted data format.');
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivPart, 'hex');
    const encryptedData = Buffer.from(dataPart, 'hex');
    const authTag = Buffer.from(tagPart, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    throw new Error('Decryption failed: data corruption or invalid key.');
  }
}


