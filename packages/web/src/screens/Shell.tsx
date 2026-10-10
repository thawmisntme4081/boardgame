// The platform's pages around the games: a centered card on a muted page, and its parts.
import { Button } from '@platform/ui/components/button';
import { Input } from '@platform/ui/components/input';
import { Label } from '@platform/ui/components/label';
import { LanguageSwitch } from '@platform/ui/LanguageSwitch';
import { Link, useRouter } from '@tanstack/react-router';
import { Dices } from 'lucide-react';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { joinRoom } from '../api';
import { NAME_MAX } from '../session';
import { AccountButton } from './Account';

export function Shell({
  children,
  wide = false,
  full = false,
  account = false,
}: {
  children: ReactNode;
  wide?: boolean;
  /** As wide as the top bar. */
  full?: boolean;
  account?: boolean;
}) {
  const { t } = useTranslation();
  const inRouter = Boolean(useRouter({ warn: false }));
  const brand = (
    <>
      <Dices className="size-5 shrink-0" aria-hidden="true" /> {t('app.title')}
    </>
  );
  const brandClass = 'flex min-h-11 items-center gap-2 text-lg font-semibold';
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="border-b bg-background px-4 py-1">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2">
          {inRouter ? (
            <Link to="/" className={brandClass}>
              {brand}
            </Link>
          ) : (
            <span className={brandClass}>{brand}</span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitch />
            {account && <AccountButton />}
          </div>
        </div>
      </header>
      <main className="flex flex-1 justify-center p-4">
        <div className={full ? 'w-full max-w-6xl' : wide ? 'w-full max-w-2xl' : 'w-full max-w-sm'}>
          {children}
        </div>
      </main>
    </div>
  );
}

/** A card heading. */
export function CardTop({ title, description }: { title?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {title && <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold">{title}</h1>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function NameField({
  name,
  onChange,
  fromAccount = false,
}: {
  name: string;
  onChange(name: string): void;
  /** Signed in: the account's name, shown but not editable. */
  fromAccount?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="name">{t('lobby.yourName')}</Label>
      <Input
        id="name"
        value={name}
        maxLength={NAME_MAX}
        autoComplete="nickname"
        readOnly={fromAccount}
        aria-describedby={fromAccount ? 'name-from-account' : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-base read-only:bg-muted read-only:text-muted-foreground"
      />
      {fromAccount && (
        <p id="name-from-account" className="text-xs text-muted-foreground">
          {t('account.nameFromAccount')}
        </p>
      )}
    </div>
  );
}

/** Join a room by its code (prefilled from an invite link). */
export function JoinForm({ name, initialCode = '' }: { name: string; initialCode?: string }) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [busy, setBusy] = useState(false);
  const ready = name.trim().length > 0 && code.length === 4;

  const onJoin = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    await joinRoom(code, name.trim());
    setBusy(false);
  };

  return (
    <form onSubmit={(e) => void onJoin(e)} className="flex flex-col gap-2">
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
        <Button type="submit" className="h-11" disabled={busy || !ready}>
          {t('lobby.join')}
        </Button>
      </div>
    </form>
  );
}

export function Or() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> {t('lobby.or')}{' '}
      <span className="h-px flex-1 bg-border" />
    </div>
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
