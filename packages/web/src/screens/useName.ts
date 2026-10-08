import { useState } from 'react';
import { loadName } from '../session';
import { usePlatform } from '../store';

/**
 * The player's name: the account's when signed in (fixed), else the one typed on this device
 * (remembered).
 */
export function useName() {
  const [typed, setName] = useState(loadName);
  const accountName = usePlatform((s) =>
    typeof s.account === 'object' ? (s.account.user?.name ?? '') : '',
  );
  const name = accountName || typed;
  return { name, setName, nameOk: name.trim().length > 0, fromAccount: Boolean(accountName) };
}
