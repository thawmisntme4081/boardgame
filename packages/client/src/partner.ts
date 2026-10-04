import { otherSeat, type PlayerView, type Presence, type Seat } from '@sky/shared';
import { t } from '@/i18n';
import { seatName } from '@/messages';

/** Your partner: their seat, their presence (if they are in the room), and what to call them. */
export function partnerOf(view: PlayerView, presence: Presence | null) {
  const seat = otherSeat(view.seat);
  const info = presence?.[seat];
  return { seat, info, name: info?.name ?? seatName(seat) };
}

export type PartnerChange =
  | { kind: 'offline'; text: string }
  | { kind: 'back'; text: string }
  | { kind: 'left'; text: string }
  | { kind: 'joined'; text: string };

/** How the partner's presence changed between two updates, if at all. */
export function partnerChange(
  before: Presence | null,
  after: Presence,
  mySeat: Seat,
): PartnerChange | null {
  if (!before) return null;
  const seat = otherSeat(mySeat);
  const was = before[seat];
  const now = after[seat];
  if (was && !now) {
    return {
      kind: 'left',
      text: t('toast.partnerLeft', { name: was.name }),
    };
  }
  if (!was && now) return { kind: 'joined', text: t('toast.partnerJoined', { name: now.name }) };
  if (was && now && was.online && !now.online) {
    return { kind: 'offline', text: t('toast.partnerOffline', { name: now.name }) };
  }
  if (was && now && !was.online && now.online)
    return { kind: 'back', text: t('toast.partnerBack', { name: now.name }) };
  return null;
}

/** A refresh drops and restores a connection within a second or two: not worth a message. */
export const OFFLINE_GRACE_MS = 3000;

/**
 * Turns presence changes into messages, holding "lost connection" back for a grace period
 * and only saying "is back" if the drop was announced.
 */
export function createPartnerNotifier(notify: (text: string) => void, graceMs = OFFLINE_GRACE_MS) {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let announced = false;
  const cancel = () => {
    if (pending) clearTimeout(pending);
    pending = null;
  };

  return (before: Presence | null, after: Presence, mySeat: Seat): void => {
    const change = partnerChange(before, after, mySeat);
    if (!change) return;
    switch (change.kind) {
      case 'offline':
        cancel();
        pending = setTimeout(() => {
          pending = null;
          announced = true;
          notify(change.text);
        }, graceMs);
        return;
      case 'back':
        cancel();
        if (announced) notify(change.text);
        announced = false;
        return;
      case 'left':
      case 'joined':
        cancel();
        announced = false;
        notify(change.text);
        return;
    }
  };
}
