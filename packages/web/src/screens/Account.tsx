// Optional accounts in the shell (Platform 06): "Sign in" for guests; signed in, the name and a
// menu (sign out). Signing in: Google, or a code sent by email; after a first email sign-in the
// name is asked once (it cannot change afterwards). Nothing here shows when accounts are off.
import { Button } from '@platform/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog';
import { Input } from '@platform/ui/components/input';
import { Label } from '@platform/ui/components/label';
import { Popover, PopoverContent, PopoverTrigger } from '@platform/ui/components/popover';
import { Link } from '@tanstack/react-router';
import { History, LogIn, LogOut, Mail, UserRound } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sendSignInCode,
  setAccountName,
  signInWithCode,
  signInWithGoogle,
  signOut,
  type CodeResult,
  type SignInMethods,
} from '../account';
import { NAME_MAX } from '../session';
import { usePlatform } from '../store';

const ERROR_KEY = {
  'too-many-tries': 'account.tooMany',
  'wrong-code': 'account.wrongCode',
  unknown: 'account.error',
} as const satisfies Record<Exclude<CodeResult, 'ok'>, string>;

/** The Google "G", in its colours (the sign-in button's usual mark). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

/** Sign in: Google, or an email code (email first, then the code). */
function SignInDialog({
  methods,
  open,
  onOpenChange,
}: {
  methods: SignInMethods;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<CodeResult, 'ok'> | null>(null);

  const reset = () => {
    setStep('email');
    setCode('');
    setError(null);
  };

  const google = async () => {
    setBusy(true);
    // On success the page goes to Google and comes back here signed in.
    if (!(await signInWithGoogle())) {
      setError('unknown');
      setBusy(false);
    }
  };

  const send = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    const result = await sendSignInCode(email.trim());
    setBusy(false);
    if (result === 'ok') {
      setStep('code');
      setError(null);
    } else setError(result);
  };

  const verify = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    const result = await signInWithCode(email.trim(), code);
    setBusy(false);
    if (result === 'ok') {
      onOpenChange(false);
      reset();
    } else {
      setError(result);
      setCode('');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('account.signInTitle')}</DialogTitle>
          <DialogDescription>{t('account.signInIntro')}</DialogDescription>
        </DialogHeader>
        {step === 'email' ? (
          <div className="flex flex-col gap-4">
            {methods.google && (
              <Button
                variant="outline"
                className="h-11"
                disabled={busy}
                onClick={() => void google()}
              >
                <GoogleMark /> {t('account.google')}
              </Button>
            )}
            {methods.email && (
              <form onSubmit={(e) => void send(e)} className="flex flex-col gap-2">
                <Label htmlFor="sign-in-email">{t('account.email')}</Label>
                <Input
                  id="sign-in-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 text-base"
                />
                <Button type="submit" className="h-11" disabled={busy || !email.trim()}>
                  <Mail /> {t('account.sendCode')}
                </Button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void verify(e)} className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {t('account.codeSent', { email: email.trim() })}
            </p>
            <Label htmlFor="sign-in-code">{t('account.code')}</Label>
            <Input
              id="sign-in-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-invalid={error !== null}
              className="h-11 font-mono text-base tracking-widest"
            />
            <Button type="submit" className="h-11" disabled={busy || code.length !== 6}>
              {t('account.verify')}
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={reset}>
              {t('account.otherEmail')}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(ERROR_KEY[error])}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** After a first email sign-in: the name, chosen once. It cannot be dismissed (only signed out). */
function NameDialog() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    const ok = await setAccountName(name.trim());
    setBusy(false);
    setFailed(!ok);
  };

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('account.nameTitle')}</DialogTitle>
          <DialogDescription>{t('account.nameIntro')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2">
          <Label htmlFor="account-name">{t('lobby.yourName')}</Label>
          <Input
            id="account-name"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            className="h-11 text-base"
          />
          {failed && (
            <p role="alert" className="text-sm text-danger">
              {t('account.error')}
            </p>
          )}
          <Button type="submit" className="h-11" disabled={busy || !name.trim()}>
            {t('account.save')}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => void signOut()}>
            {t('account.signOut')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Top of the game picker and the game page: "Sign in", or the signed-in name and its menu. */
export function AccountButton() {
  const { t } = useTranslation();
  const account = usePlatform((s) => s.account);
  const [open, setOpen] = useState(false);
  if (account === 'loading' || account === 'off') return null;

  const { user, methods } = account;
  if (!user) {
    return (
      <>
        <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
          <LogIn /> {t('account.signIn')}
        </Button>
        <SignInDialog methods={methods} open={open} onOpenChange={setOpen} />
      </>
    );
  }
  if (!user.name) return <NameDialog />;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 max-w-36"
          aria-label={t('account.menu', { name: user.name })}
        >
          <UserRound /> <span className="truncate">{user.name}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm">
          {t('account.signedInAs')} <span className="font-medium break-all">{user.email}</span>
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link to="/history">
            <History /> {t('account.history')}
          </Link>
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void signOut()}>
          <LogOut /> {t('account.signOut')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
