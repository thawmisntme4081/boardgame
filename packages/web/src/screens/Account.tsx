// Optional accounts in the shell (Platform 06): "Sign in" for guests; signed in, the name and a
// menu (sign out). Signing in uses Google. Nothing here shows when accounts are off.
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
import { History, LogIn, LogOut, Pencil, Trash2, UserRound } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { setAccountName, signInWithGoogle, deleteAccount, signOut } from '../account';
import { NAME_MAX } from '../session';
import { usePlatform } from '../store';

/** The Google "G", in its colors (the sign-in button's usual mark). */
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

/** Sign in with Google. */
function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    // On success the page goes to Google and comes back here signed in.
    if (!(await signInWithGoogle())) {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('account.signInTitle')}</DialogTitle>
          <DialogDescription>{t('account.signInIntro')}</DialogDescription>
        </DialogHeader>
        <Button variant="outline" className="h-11" disabled={busy} onClick={() => void google()}>
          <GoogleMark /> {t('account.google')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** If Google provided no name: choose one once. It cannot be dismissed (only signed out). */
function NameDialog({ current = '', onClose }: { current?: string; onClose?: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    const ok = await setAccountName(name.trim());
    setBusy(false);
    setFailed(!ok);
    if (ok) onClose?.();
  };

  // Asked once after a sign-in without a name: it cannot be dismissed. Changing it can.
  const required = !onClose;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        showCloseButton={!required}
        className="sm:max-w-sm"
        onEscapeKeyDown={(e) => required && e.preventDefault()}
        onInteractOutside={(e) => required && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t(required ? 'account.nameTitle' : 'account.changeNameTitle')}</DialogTitle>
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

/** Asks before deleting the account: it cannot be undone. */
function DeleteAccountDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    setBusy(true);
    const ok = await deleteAccount();
    setBusy(false);
    setFailed(!ok);
    if (ok) setOpen(false);
  };
  return (
    <>
      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setOpen(true)}>
        <Trash2 /> {t('account.delete')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('account.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('account.deleteIntro')}</DialogDescription>
          </DialogHeader>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('account.error')}
            </p>
          )}
          <Button
            variant="destructive"
            className="h-11"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {t('account.deleteConfirm')}
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => setOpen(false)}>
            {t('lobby.cancel')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Top of the game picker and the game page: "Sign in", or the signed-in name and its menu. */
export function AccountButton() {
  const { t } = useTranslation();
  const account = usePlatform((s) => s.account);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  if (account === 'loading' || account === 'off') return null;

  const { user } = account;
  if (!user) {
    return (
      <>
        <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
          <LogIn /> {t('account.signIn')}
        </Button>
        <SignInDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }
  if (!user.name) return <NameDialog />;
  return (
    <>
      {renaming && <NameDialog current={user.name} onClose={() => setRenaming(false)} />}
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
          <Button variant="outline" className="h-11" onClick={() => setRenaming(true)}>
            <Pencil /> {t('account.changeName')}
          </Button>
          <Button variant="outline" className="h-11" onClick={() => void signOut()}>
            <LogOut /> {t('account.signOut')}
          </Button>
          <DeleteAccountDialog />
        </PopoverContent>
      </Popover>
    </>
  );
}
