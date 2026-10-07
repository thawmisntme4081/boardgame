import { Toaster } from '@platform/ui/components/sonner';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { loadAccount } from './account';
import { accountChanged, checkSiteAccess, startConnection } from './api';
import { router } from './router';
import { Connecting } from './screens/Shell';
import { SitePassword } from './screens/SitePassword';
import { usePlatform } from './store';

export function App() {
  const siteAccess = usePlatform((s) => s.siteAccess);
  // A private site asks for its password before anything else; the game connects after.
  useEffect(() => {
    void checkSiteAccess().then((ok) =>
      usePlatform.getState().setSiteAccess(ok ? 'open' : 'locked'),
    );
  }, []);
  useEffect(() => {
    if (siteAccess !== 'open') return;
    startConnection();
    // Accounts come after the site password (their endpoints sit behind it).
    void loadAccount();
  }, [siteAccess]);
  // Signed in or out (or the account just loaded): the seat may follow the account.
  const userId = usePlatform((s) =>
    typeof s.account === 'object' ? (s.account.user?.id ?? null) : undefined,
  );
  useEffect(() => {
    if (userId !== undefined) accountChanged();
  }, [userId]);
  return (
    <>
      {siteAccess === 'checking' ? (
        <Connecting />
      ) : siteAccess === 'locked' ? (
        <SitePassword />
      ) : (
        <RouterProvider router={router} />
      )}
      <Toaster position="top-center" />
    </>
  );
}
