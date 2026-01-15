/**
 * Cryptographic utilities for secure random strings and token encryption
 */

import { generateRandomString as osloGenerateRandomString } from "@oslojs/crypto/random";

/**
 * Secure alphabet for OTP/token generation
 * Excludes ambiguous characters: 0/O, 1/l/I
 * 30 characters providing high entropy
 */
export const SECURE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a cryptographically secure random string
 * @param length - Length of the string to generate
 * @param alphabet - Character set to use for generation
 * @returns A random string of the specified length using the given alphabet
 */
export function generateRandomString(
  length: number,
  alphabet: string
): string {
  const random = {
    read(bytes: Uint8Array) {
      crypto.getRandomValues(bytes);
    },
  };
  return osloGenerateRandomString(random, alphabet, length);
}

/**
 * Generate a secure OTP token
 * Uses 12 characters from SECURE_ALPHABET (30^12 = 5.3 * 10^17 combinations)
 * Much stronger than 8-digit numeric (10^8 combinations)
 */
export function generateSecureOTP(): string {
  return generateRandomString(12, SECURE_ALPHABET);
}

// ============================================================================
// Token Encryption for OAuth Tokens
// Uses AES-256-GCM for authenticated encryption
// ============================================================================

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Get the encryption key from environment variable
 * Key must be 32 bytes (256 bits) hex-encoded (64 characters)
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getEncryptionKey(): Uint8Array {
  const keyHex = process.env.OAUTH_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("OAUTH_ENCRYPTION_KEY environment variable is not set");
  }
  if (keyHex.length !== 64) {
    throw new Error("OAUTH_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  // Convert hex string to Uint8Array
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = parseInt(keyHex.substring(i * 2, i * 2 + 2), 16);
  }
  return key;
}

/**
 * Import key for Web Crypto API
 */
async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  // Create a proper ArrayBuffer from the Uint8Array to satisfy TypeScript
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);
  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a token using AES-256-GCM
 * @param plaintext - The token to encrypt
 * @returns Base64-encoded ciphertext (IV + encrypted data + tag)
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const keyBytes = getEncryptionKey();
  const cryptoKey = await importKey(keyBytes);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt the plaintext
  const encodedPlaintext = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    cryptoKey,
    encodedPlaintext
  );

  // Combine IV + ciphertext (includes auth tag)
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  // Return base64-encoded
  return btoa(String.fromCharCode(...Array.from(combined)));
}

/**
 * Decrypt a token using AES-256-GCM
 * @param ciphertext - Base64-encoded ciphertext (IV + encrypted data + tag)
 * @returns The decrypted token
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  const keyBytes = getEncryptionKey();
  const cryptoKey = await importKey(keyBytes);

  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const encryptedData = combined.slice(IV_LENGTH);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    cryptoKey,
    encryptedData
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a string appears to be an encrypted token (base64-encoded)
 * Used to determine if migration is needed
 */
export function isEncryptedToken(value: string): boolean {
  // Encrypted tokens are base64 and at least IV_LENGTH bytes when decoded
  try {
    const decoded = atob(value);
    return decoded.length >= IV_LENGTH;
  } catch {
    return false;
  }
}
