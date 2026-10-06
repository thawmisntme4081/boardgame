import { useState } from 'react';
import { loadName } from '../session';

/** The player's name, remembered on this device. */
export function useName() {
  const [name, setName] = useState(loadName);
  return { name, setName, nameOk: name.trim().length > 0 };
}
