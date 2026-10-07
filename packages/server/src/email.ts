// Email sign-in codes. Production sends them through Resend (`RESEND_API_KEY`, from
// `EMAIL_FROM`); development without a key prints the code in the server's terminal instead.
import { log } from './log';

/** Sends a one-time sign-in code to an address. Rejects when the email could not be sent. */
export type SendCode = (email: string, code: string) => Promise<void>;

export function resendSender({ apiKey, from }: { apiKey: string; from: string }): SendCode {
  return async (email, code) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: email,
        subject: `Your sign-in code: ${code}`,
        text: `Your sign-in code is ${code}. It works once, for 5 minutes.\n\nIf you did not ask for it, ignore this email.`,
      }),
    });
    // The code is never logged; Resend's answer says why it failed.
    if (!res.ok) throw new Error(`email not sent (Resend ${res.status}: ${await res.text()})`);
  };
}

/**
 * Development only (never in production): the code goes to the terminal, so email sign-in
 * works without an email service.
 */
export const terminalSender: SendCode = (email, code) => {
  log.warn({ email }, `DEV ONLY sign-in code: ${code}`);
  return Promise.resolve();
};
