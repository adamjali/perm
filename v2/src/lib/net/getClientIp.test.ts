import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the official Vercel helper so we can drive the primary path explicitly.
const ipAddressMock = vi.fn<(request: Request) => string | undefined>();
vi.mock('@vercel/functions', () => ({
  ipAddress: (request: Request) => ipAddressMock(request),
}));

import { getClientIp } from './getClientIp';

const reqWith = (headers: Record<string, string> = {}): Request =>
  new Request('https://permtracker.app/api/chat', { headers });

describe('getClientIp', () => {
  beforeEach(() => {
    ipAddressMock.mockReset();
  });

  it('prefers the Vercel-attested ipAddress() value when present', () => {
    ipAddressMock.mockReturnValue('203.0.113.7');
    const ip = getClientIp(reqWith({ 'x-forwarded-for': '1.1.1.1' }));
    expect(ip).toBe('203.0.113.7');
  });

  it('falls back to x-vercel-forwarded-for (first hop) when helper returns undefined', () => {
    ipAddressMock.mockReturnValue(undefined);
    const ip = getClientIp(
      reqWith({ 'x-vercel-forwarded-for': '198.51.100.4, 10.0.0.1' }),
    );
    expect(ip).toBe('198.51.100.4');
  });

  it('falls back to x-forwarded-for when no Vercel headers are present', () => {
    ipAddressMock.mockReturnValue(undefined);
    const ip = getClientIp(reqWith({ 'x-forwarded-for': '198.51.100.9, 10.0.0.2' }));
    expect(ip).toBe('198.51.100.9');
  });

  it('falls back to x-real-ip last', () => {
    ipAddressMock.mockReturnValue(undefined);
    const ip = getClientIp(reqWith({ 'x-real-ip': '192.0.2.55' }));
    expect(ip).toBe('192.0.2.55');
  });

  it('returns undefined when no IP can be resolved (local dev)', () => {
    ipAddressMock.mockReturnValue(undefined);
    expect(getClientIp(reqWith())).toBeUndefined();
  });
});
