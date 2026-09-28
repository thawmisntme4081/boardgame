import { describe, expect, it } from 'vitest';
import { clientIp } from './handlers';

type FakeSocket = Parameters<typeof clientIp>[0];

const socketFrom = (address: string, forwarded?: string | string[]) =>
  ({
    handshake: { address, headers: forwarded ? { 'x-forwarded-for': forwarded } : {} },
  }) as unknown as FakeSocket;

describe('clientIp', () => {
  it('uses the socket address by default, ignoring X-Forwarded-For', () => {
    expect(clientIp(socketFrom('10.0.0.5', '203.0.113.9'))).toBe('10.0.0.5');
  });

  it('trusts the first X-Forwarded-For entry behind a proxy', () => {
    expect(clientIp(socketFrom('10.0.0.5', '203.0.113.9, 10.0.0.1'), true)).toBe('203.0.113.9');
    expect(clientIp(socketFrom('10.0.0.5', ['198.51.100.7']), true)).toBe('198.51.100.7');
  });

  it('falls back to the socket address when the header is missing', () => {
    expect(clientIp(socketFrom('10.0.0.5'), true)).toBe('10.0.0.5');
    expect(clientIp(socketFrom(''))).toBe('unknown');
  });
});
