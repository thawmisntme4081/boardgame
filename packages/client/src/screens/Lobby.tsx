import { ROUND_TIMER_MS, type Scenario, type Seat } from '@sky/shared';
import { Plane, Share2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoom, joinRoom, leaveGame, shareInvite } from '@/api';
import { Button } from '@/components/ui/button';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { FlightLog } from '@/components/FlightLog';
import { DifficultyDot, ScenarioPicker } from '@/components/ScenarioPicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatClock } from '@/lib/clock';
import { DEFAULT_SETUP, scenarioSummary } from '@/lib/setup';
import { codeFromPath, inviteUrl, loadName } from '@/session';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

/** Create a game or join one by code; `/r/ABCD` links prefill the code. */
export function Lobby() {
  const { t } = useTranslation();
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(() => codeFromPath(window.location.pathname));
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(false);
  const [setup, setSetup] = useState(DEFAULT_SETUP);
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
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plane className="size-5" aria-hidden="true" /> {t('app.title')}
            </CardTitle>
            <LanguageSwitch className="-mt-2 -mr-2" />
          </div>
          <CardDescription>{t('app.tagline')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('lobby.yourName')}</Label>
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
            <Label htmlFor="code">{t('lobby.gameCode')}</Label>
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
                {t('lobby.join')}
              </Button>
            </div>
          </form>

          {!invited && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> {t('lobby.or')}{' '}
                <span className="h-px flex-1 bg-border" />
              </div>
              <ScenarioPicker id="lobby" value={setup} onChange={setSetup} />
              {/* The whole row is the label, so it is an easy target on a phone. */}
              <Label htmlFor="timer" className="flex min-h-11 cursor-pointer items-center gap-3">
                <span className="flex flex-1 flex-col gap-0.5">
                  <span>{t('lobby.roundTimer')}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('lobby.roundTimerHint', { time: formatClock(ROUND_TIMER_MS) })}
                  </span>
                </span>
                <Switch id="timer" checked={timer} onCheckedChange={setTimer} />
              </Label>
              <Button
                variant="secondary"
                className="h-11"
                disabled={busy || !nameOk}
                onClick={() => void run(() => createRoom(name.trim(), timer, setup))}
              >
                {t('lobby.create')}
              </Button>
              <FlightLog />
            </>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

/** Waiting for the empty seat to be filled: after creating a game, or after a partner left. */
export function WaitingRoom({
  code,
  missing = 'copilot',
  timerMs = null,
  scenario,
}: {
  code: string;
  missing?: Seat;
  /** Timed game: shown so whoever joins knows before they start. */
  timerMs?: number | null;
  scenario?: Scenario;
}) {
  const { t } = useTranslation();
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('lobby.waitingFor', { context: missing })}</CardTitle>
          <CardDescription>
            {t('lobby.sendCode')}
            {timerMs !== null && t('lobby.timedGame', { time: formatClock(timerMs) })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {scenario && (
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <DifficultyDot scenario={scenario} /> {scenario.name}
              </p>
              <p className="text-xs text-muted-foreground">{scenarioSummary(scenario)}</p>
            </div>
          )}
          <p
            className="text-center font-mono text-5xl font-bold tracking-[0.3em]"
            aria-label={t('lobby.gameCodeLabel', { spelled: code.split('').join(' ') })}
          >
            {code}
          </p>
          <p className="truncate text-center text-sm text-muted-foreground">{inviteUrl(code)}</p>
          <Button className="h-11" onClick={() => void shareInvite(code)}>
            <Share2 /> {t('lobby.shareInvite')}
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => void leaveGame()}>
            {t('lobby.cancel')}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

export function Connecting() {
  const { t } = useTranslation();
  return (
    <Shell>
      <p className="text-center text-sm text-muted-foreground" role="status">
        {t('lobby.connecting')}
      </p>
    </Shell>
  );
}
