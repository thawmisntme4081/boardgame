// Toasts about the other players' connections: someone dropped, came back, left or joined.
import { seatInfo, type SeatPresence } from '@platform/ui/game';
import i18n from '@platform/ui/i18n';

const t = i18n.getFixedT(null, 'platform');

export type PartnerChange = { seat: string; text: string } & (
  { kind: 'offline' } | { kind: 'back' } | { kind: 'left' } | { kind: 'joined' }
);

const seatsOf = (presence: SeatPresence) => Object.keys(presence).filter((k) => k !== 'you');

/** How another player's presence changed between two updates, if at all. */
export function partnerChange(
  before: SeatPresence | null,
  after: SeatPresence,
  mySeat: string,
): PartnerChange | null {
  if (!before) return null;
  for (const seat of seatsOf(after)) {
    if (seat === mySeat) continue;
    const was = seatInfo(before, seat);
    const now = seatInfo(after, seat);
    if (was && !now) {
      return { seat, kind: 'left', text: t('toast.partnerLeft', { name: was.name }) };
    }
    if (!was && now) {
      return { seat, kind: 'joined', text: t('toast.partnerJoined', { name: now.name }) };
    }
    if (was && now && was.online && !now.online) {
      return { seat, kind: 'offline', text: t('toast.partnerOffline', { name: now.name }) };
    }
    if (was && now && !was.online && now.online) {
      return { seat, kind: 'back', text: t('toast.partnerBack', { name: now.name }) };
    }
  }
  return null;
}

/** A refresh drops and restores a connection within a second or two: not worth a message. */
export const OFFLINE_GRACE_MS = 3000;

/**
 * Turns presence changes into messages, holding "lost connection" back for a grace period
 * and only saying "is back" if the drop was announced. Each player is followed on their own,
 * so with several players one's drop never hides another's.
 */
export function createPartnerNotifier(notify: (text: string) => void, graceMs = OFFLINE_GRACE_MS) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const announced = new Set<string>();
  const cancel = (seat: string) => {
    clearTimeout(pending.get(seat));
    pending.delete(seat);
  };

  return (before: SeatPresence | null, after: SeatPresence, mySeat: string): void => {
    const change = partnerChange(before, after, mySeat);
    if (!change) return;
    const { seat } = change;
    switch (change.kind) {
      case 'offline':
        cancel(seat);
        pending.set(
          seat,
          setTimeout(() => {
            pending.delete(seat);
            announced.add(seat);
            notify(change.text);
          }, graceMs),
        );
        return;
      case 'back':
        cancel(seat);
        if (announced.delete(seat)) notify(change.text);
        return;
      case 'left':
      case 'joined':
        cancel(seat);
        announced.delete(seat);
        notify(change.text);
        return;
    }
  };
}
