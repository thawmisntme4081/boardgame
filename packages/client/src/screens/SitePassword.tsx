// The private site's door: one shared password, asked once per browser (kept 30 days).
import { LockKeyhole, Plane } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { enterSitePassword, type PasswordResult } from '@/api';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGame } from '@/store';
import { Shell } from './Lobby';

const ERROR_KEY: Record<
  Exclude<PasswordResult, 'ok'>,
  'gate.wrong' | 'gate.tooMany' | 'gate.error'
> = {
  'wrong-password': 'gate.wrong',
  'too-many-tries': 'gate.tooMany',
  unknown: 'gate.error',
};

export function SitePassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<PasswordResult, 'ok'> | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    const result = await enterSitePassword(password);
    setBusy(false);
    if (result === 'ok') {
      // The game connects and the page carries on where the link pointed (lobby or a room).
      useGame.getState().setSiteAccess('open');
      return;
    }
    setError(result);
    setPassword('');
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
          <CardDescription className="flex items-center gap-1.5">
            <LockKeyhole className="size-4 shrink-0" aria-hidden="true" /> {t('gate.intro')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="site-password">{t('gate.password')}</Label>
              <Input
                id="site-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error !== null}
                className="h-11 text-base"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {t(ERROR_KEY[error])}
              </p>
            )}
            <Button type="submit" className="h-11" disabled={busy || !password}>
              {t('gate.enter')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}
