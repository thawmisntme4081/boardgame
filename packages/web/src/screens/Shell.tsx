// The platform's pages around the games: a centered card on a muted page, and its parts.
import { Button } from '@platform/ui/components/button';
import { Input } from '@platform/ui/components/input';
import { Label } from '@platform/ui/components/label';
import { LanguageSwitch } from '@platform/ui/LanguageSwitch';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { joinRoom } from '../api';
import { NAME_MAX } from '../session';
import { AccountButton } from './Account';

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-sm'}>{children}</div>
    </main>
  );
}

/** A card heading with the language switch (and, if asked, sign-in) on the right. */
export function CardTop({
  title,
  description,
  account = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Show "Sign in" or the signed-in name (the game picker and the game pages). */
  account?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold">{title}</h1>
        <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
          {account && <AccountButton />}
          <LanguageSwitch />
        </div>
      </div>
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
