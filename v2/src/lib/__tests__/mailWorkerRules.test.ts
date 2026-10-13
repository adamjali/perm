/**
 * The mail Worker (workers/mail/) decides what reaches the owner's inbox the
 * way the app did while Resend received the mail, and checks its keys and
 * owner messages before it sends anything.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain ES module the Worker bundles; no type declarations.
import { KEY_PATTERN, keyMatches, keyTag, ownerMessage, ownerRecipient, provisionOpen, shouldForward } from '../../../workers/mail/rules.mjs';
import { shouldForwardInbound } from '@convex/lib/supportEmailForward';

const OWNER = 'owner@example.com';

describe('shouldForward matches the app rule it replaces', () => {
  it.each([
    ['support@permtracker.app', 'person@example.com'],
    ['support@permtracker.app', 'PERM Tracker <notifications@permtracker.app>'],
    ['demo@permtracker.app', 'notifications@permtracker.app'],
    ['dmarc@permtracker.app', 'reports@google.com'],
    [OWNER, 'someone@example.com'],
    ['hello@permtracker.app', 'Someone <someone@example.com>'],
  ])('to %s from %s', (to, from) => {
    expect(shouldForward(to, OWNER, from)).toBe(shouldForwardInbound(to, OWNER, from));
  });
});

describe('keyMatches', () => {
  it('matches only the exact key, and nothing when unset', async () => {
    expect(await keyMatches('secret-key', 'secret-key')).toBe(true);
    expect(await keyMatches('secret-kex', 'secret-key')).toBe(false);
    expect(await keyMatches('', 'secret-key')).toBe(false);
    expect(await keyMatches('anything', undefined)).toBe(false);
  });
});

describe('ownerMessage', () => {
  it('takes a subject and text, strips line breaks from the subject', () => {
    expect(ownerMessage({ subject: 'Disk\nfull', text: 'x' })).toEqual({ subject: 'Disk full', text: 'x' });
  });
  it('refuses a missing subject or text, or too much', () => {
    expect(ownerMessage({ text: 'x' }).error).toBeTruthy();
    expect(ownerMessage({ subject: 's' }).error).toBeTruthy();
    expect(ownerMessage({ subject: 's'.repeat(301), text: 'x' }).error).toBeTruthy();
    expect(ownerMessage(null).error).toBeTruthy();
  });
  it('carries a reply-to and an inbox, and refuses anything that isn\'t one address', () => {
    expect(ownerMessage({ subject: 's', text: 'x', to: 'Me@Example.com', replyTo: 'person@example.org' })).toEqual({
      subject: 's', text: 'x', to: 'me@example.com', replyTo: 'person@example.org',
    });
    expect(ownerMessage({ subject: 's', text: 'x', replyTo: 'a@b.com, c@d.com' }).error).toBeTruthy();
    expect(ownerMessage({ subject: 's', text: 'x', to: 'Name <a@b.com>' }).error).toBeTruthy();
    expect(ownerMessage({ subject: 's', text: 'x', to: 7 }).error).toBeTruthy();
  });
});

describe('ownerRecipient', () => {
  it('sends to the main inbox when none is named', () => {
    expect(ownerRecipient(undefined, ' Owner@Example.com ')).toBe('owner@example.com');
  });
  it('allows the main inbox and the listed ones, and no other address', () => {
    expect(ownerRecipient('owner@example.com', OWNER)).toBe('owner@example.com');
    expect(ownerRecipient('second@example.org', OWNER, 'second@example.org, third@example.net')).toBe('second@example.org');
    expect(ownerRecipient('stranger@example.com', OWNER, 'second@example.org')).toBeNull();
    expect(ownerRecipient('second@example.org', OWNER)).toBeNull();
  });
});

describe('provisioned keys', () => {
  it('accept only 64 hex characters, and tag a key by its hash, never the key', async () => {
    expect(KEY_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(KEY_PATTERN.test('a'.repeat(63))).toBe(false);
    expect(KEY_PATTERN.test('A'.repeat(64))).toBe(false);
    const tag = await keyTag('a'.repeat(64));
    expect(tag).toMatch(/^[0-9a-f]{8}$/);
    expect('a'.repeat(64)).not.toContain(tag);
  });
});

describe('the provisioning window', () => {
  const now = Date.parse('2026-10-12T22:00:00Z');
  it('is shut unless an upload opened it, and never for more than an hour', () => {
    expect(provisionOpen(undefined, now)).toBe(false);
    expect(provisionOpen('', now)).toBe(false);
    expect(provisionOpen('not a date', now)).toBe(false);
    expect(provisionOpen('2026-10-12T21:59:00Z', now)).toBe(false); // passed
    expect(provisionOpen('2026-10-12T22:15:00Z', now)).toBe(true); // a rotation window
    expect(provisionOpen('2026-10-12T23:00:00Z', now)).toBe(true); // the hour itself
    expect(provisionOpen('2026-10-13T22:00:00Z', now)).toBe(false); // a day: too long to leave open
  });
});
