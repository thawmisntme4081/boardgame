import type { Seat } from '@sky/shared';
import { Plane, Share2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createRoom, joinRoom, leaveGame, shareInvite } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { codeFromPath, inviteUrl, loadName } from '@/session';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

/** Create a game or join one by code; `/r/ABCD` links prefill the code. */
export function Lobby() {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(() => codeFromPath(window.location.pathname));
  const [busy, setBusy] = useState(false);
  const invited = codeFromPath(window.location.pathname) !== '';
  const nameOk = name.trim().length > 0;

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    if (nameOk && code.length === 4) void run(() => joinRoom(code, name.trim()));
  };

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plane className="size-5" aria-hidden="true" /> Sky Team Online
          </CardTitle>
          <CardDescription>
            Land the plane together: one pilot, one co-pilot, no talking once the dice are rolled.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              maxLength={20}
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          <form onSubmit={onJoin} className="flex flex-col gap-2">
            <Label htmlFor="code">Game code</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                value={code}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="ABCD"
                onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                className="h-11 font-mono text-base tracking-widest uppercase"
              />
              <Button
                type="submit"
                className="h-11"
                disabled={busy || !nameOk || code.length !== 4}
              >
                Join
              </Button>
            </div>
          </form>

          {!invited && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or{' '}
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="secondary"
                className="h-11"
                disabled={busy || !nameOk}
                onClick={() => void run(() => createRoom(name.trim()))}
              >
                Create a game
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

/** Waiting for the empty seat to be filled: after creating a game, or after a partner left. */
export function WaitingRoom({ code, missing = 'copilot' }: { code: string; missing?: Seat }) {
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Waiting for your {missing === 'pilot' ? 'pilot' : 'co-pilot'}
          </CardTitle>
          <CardDescription>Send them this code or the invite link.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p
            className="text-center font-mono text-5xl font-bold tracking-[0.3em]"
            aria-label={`Game code ${code.split('').join(' ')}`}
          >
            {code}
          </p>
          <p className="truncate text-center text-sm text-muted-foreground">{inviteUrl(code)}</p>
          <Button className="h-11" onClick={() => void shareInvite(code)}>
            <Share2 /> Share invite
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => void leaveGame()}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

export function Connecting() {
  return (
    <Shell>
      <p className="text-center text-sm text-muted-foreground" role="status">
        Connecting to your game…
      </p>
    </Shell>
  );
}
