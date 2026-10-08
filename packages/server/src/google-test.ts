import { vi } from 'vitest';

const idToken = (claims: Record<string, unknown>) =>
  [{ alg: 'none', typ: 'JWT' }, claims, 'sig']
    .map((part) =>
      Buffer.from(typeof part === 'string' ? part : JSON.stringify(part)).toString('base64url'),
    )
    .join('.');

/** Mocks Google's token exchange and returns a helper that completes a Google sign-in. */
export function mockGoogleSignIn() {
  const realFetch = globalThis.fetch;
  const pending: Record<string, unknown>[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target.startsWith('https://oauth2.googleapis.com/token')) {
      const claims = pending.shift();
      if (!claims) throw new Error('No Google test identity queued');
      return Promise.resolve(
        Response.json({
          access_token: 'google-access',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: idToken({ email_verified: true, ...claims }),
        }),
      );
    }
    return realFetch(input, init);
  });

  return async (url: string, email: string, name = email.split('@')[0]!) => {
    const begin = await fetch(`${url}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
      redirect: 'manual',
    });
    const { url: googleUrl } = (await begin.json()) as { url: string };
    const cookies = begin.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
    const state = new URL(googleUrl).searchParams.get('state')!;
    pending.push({ sub: `google-${email}`, email, name });
    const callback = await fetch(`${url}/api/auth/callback/google?code=abc&state=${state}`, {
      headers: { cookie: cookies },
      redirect: 'manual',
    });
    return callback.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
  };
}
