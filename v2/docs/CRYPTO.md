# Cryptographic Security Documentation

> **Module:** `convex/lib/crypto.ts`
> **Last Updated:** 2026-01-03

This document describes the cryptographic utilities used in PERM Tracker v2 for secure token generation and OAuth credential encryption.

---

## Overview

The crypto module provides two main capabilities:

1. **Secure Random String Generation** - For OTPs and verification tokens
2. **Token Encryption** - For storing OAuth refresh tokens securely

---

## 1. Secure Random String Generation

### Algorithm

Uses `@oslojs/crypto/random` with the Web Crypto API (`crypto.getRandomValues()`) for cryptographically secure random number generation.

### Secure Alphabet

```typescript
const SECURE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
```

**Design decisions:**
- 30 characters (excludes ambiguous: 0/O, 1/l/I)
- Uppercase only for user-friendly OTPs
- High entropy: 30^12 = 5.3 * 10^17 combinations for 12-char tokens

### Usage

```typescript
import { generateSecureOTP, generateRandomString, SECURE_ALPHABET } from './lib/crypto';

// Generate a 12-character OTP (default)
const otp = generateSecureOTP();  // e.g., "A2B3C4D5E6F7"

// Generate custom length token
const token = generateRandomString(16, SECURE_ALPHABET);

// Use custom alphabet
const numericPin = generateRandomString(6, "0123456789");
```

---

## 2. OAuth Token Encryption

OAuth refresh tokens are encrypted at rest using AES-256-GCM authenticated encryption.

### Algorithm Specifications

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key Size | 256 bits (32 bytes) |
| IV Size | 96 bits (12 bytes) |
| Auth Tag | 128 bits (16 bytes) |
| Encoding | Base64 |

### Security Properties

1. **Authenticated Encryption** - GCM mode provides both confidentiality and integrity
2. **Random IV** - Each encryption uses a fresh random IV (never reused)
3. **Key Isolation** - Encryption key stored separately from encrypted data
4. **Tamper Detection** - Any modification to ciphertext will cause decryption to fail

### Ciphertext Format

```
| IV (12 bytes) | Ciphertext | Auth Tag (16 bytes) |
|---------------|------------|---------------------|
```

All components are concatenated and Base64-encoded for storage.

---

## 3. Key Generation

### Generating an Encryption Key

Run this command to generate a new 256-bit encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or using OpenSSL:

```bash
openssl rand -hex 32
```

**Output example:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Environment Configuration

Set the key in Convex environment variables:

```bash
# Convex Dashboard → Settings → Environment Variables
OAUTH_ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Requirements:**
- Exactly 64 hexadecimal characters (32 bytes)
- Keep different keys for development vs production
- Never commit keys to source control

---

## 4. Error Handling

### Encryption Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `OAUTH_ENCRYPTION_KEY environment variable is not set` | Missing env var | Add key to Convex dashboard |
| `OAUTH_ENCRYPTION_KEY must be 64 hex characters` | Wrong key format | Regenerate with correct length |

### Decryption Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `OperationError` (Web Crypto) | Tampered ciphertext | Data integrity violation - re-encrypt |
| `OperationError` (Web Crypto) | Wrong key | Verify correct key is configured |
| Invalid base64 | Corrupted data | Re-encrypt the token |

### Handling Decryption Failures

```typescript
try {
  const token = await decryptToken(encryptedValue);
} catch (error) {
  // Decryption failed - token may be:
  // 1. Corrupted
  // 2. Encrypted with a different key
  // 3. Not encrypted at all (legacy)

  if (!isEncryptedToken(encryptedValue)) {
    // Legacy unencrypted token - migrate it
    return encryptAndStore(encryptedValue);
  }

  // Encrypted but failed - requires re-authentication
  throw new Error("OAuth token invalid - please reconnect");
}
```

---

## 5. Token Migration

The `isEncryptedToken()` helper identifies encrypted vs legacy plain tokens:

```typescript
import { isEncryptedToken, encryptToken } from './lib/crypto';

// Check if migration needed
if (!isEncryptedToken(storedToken)) {
  // Legacy plain token - encrypt it
  const encrypted = await encryptToken(storedToken);
  await updateStoredToken(encrypted);
}
```

**Migration criteria:**
- Encrypted tokens decode to at least 12 bytes (IV length)
- Plain tokens fail base64 decode or are too short

---

## 6. Security Best Practices

### Key Management

1. **Rotation** - Rotate keys annually or after suspected compromise
2. **Separation** - Use different keys per environment (dev/staging/prod)
3. **Access** - Limit key access to production admins only
4. **Backup** - Store backup in secure vault (not git)

### Implementation Notes

1. **Never log tokens** - Neither encrypted nor decrypted values
2. **Memory cleanup** - Tokens processed in-memory only, not persisted in logs
3. **Key derivation** - Consider HKDF if deriving multiple keys from master
4. **IV uniqueness** - Guaranteed by `crypto.getRandomValues()`

---

## 7. API Reference

### Functions

```typescript
// Generate secure OTP (12 chars)
function generateSecureOTP(): string

// Generate random string with custom length/alphabet
function generateRandomString(length: number, alphabet: string): string

// Encrypt a token (async)
function encryptToken(plaintext: string): Promise<string>

// Decrypt a token (async)
function decryptToken(ciphertext: string): Promise<string>

// Check if value is encrypted
function isEncryptedToken(value: string): boolean
```

### Constants

```typescript
// Secure alphabet for OTP generation (30 chars, no ambiguous)
const SECURE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
```

---

## 8. Testing

Crypto functions are tested in `convex/lib/__tests__/crypto.test.ts`.

Run tests:
```bash
pnpm test:run convex/lib/__tests__/crypto.test.ts
```

Test coverage includes:
- Random string generation entropy
- Encryption/decryption round-trip
- Key format validation
- Error handling for missing/invalid keys
- Token migration detection

---

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM Specification (NIST SP 800-38D)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Oslo Crypto Library](https://oslo.js.org/)
