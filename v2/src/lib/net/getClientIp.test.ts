import { describe, it, expect } from 'vitest';
import { getClientIp } from './getClientIp';

const reqWith = (headers: Record<string, string> = {}): Request =>
  new Request('https://permtracker.app/api/chat', { headers });

describe('getClientIp', () => {
  it('reads x-real-ip, the address nginx sets from Cloudflare', () => {
    expect(getClientIp(reqWith({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' }))).toBe('203.0.113.7');
  });

  it('falls back to the first x-forwarded-for hop', () => {
    expect(getClientIp(reqWith({ 'x-forwarded-for': '198.51.100.9, 10.0.0.2' }))).toBe('198.51.100.9');
  });

  it('ignores a blank x-real-ip', () => {
    expect(getClientIp(reqWith({ 'x-real-ip': '  ', 'x-forwarded-for': '198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('returns undefined when no IP can be resolved (local dev)', () => {
    expect(getClientIp(reqWith())).toBeUndefined();
  });
});
