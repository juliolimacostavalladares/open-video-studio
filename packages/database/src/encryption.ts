import crypto from 'crypto';

// AES-256-GCM configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Dev key fallback of exactly 32 bytes
const DEFAULT_KEY = Buffer.from('dev_secret_key_32_bytes_long_!!!', 'utf8');

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    // Only warn in dev mode, in production it must fail if key is missing/invalid
    if (process.env.NODE_ENV === 'production') {
      throw new Error('❌ Missing ENCRYPTION_KEY environment variable in production mode!');
    }
    return DEFAULT_KEY;
  }

  // If env key is hex-encoded, parse it, otherwise hash it to ensure 32-byte key length
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }

  // fallback to a sha256 hash of the env string to ensure exactly 32 bytes
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts cleartext string using AES-256-GCM
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:encryptedData:authTag
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Decrypts cipherText back into cleartext string
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return cipherText;

  const parts = cipherText.split(':');
  const ivPart = parts[0];
  const dataPart = parts[1];
  const tagPart = parts[2];

  if (parts.length !== 3 || !ivPart || !dataPart || !tagPart) {
    // If not in the expected encrypted format, throw to notify invalid data
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
