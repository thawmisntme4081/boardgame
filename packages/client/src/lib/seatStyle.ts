import type { Seat } from '@sky/shared';

/** Each seat's colour classes (blue pilot, orange co-pilot), written out in full for Tailwind. */
export const SEAT_STYLE = {
  pilot: {
    text: 'text-pilot',
    /** The "Your turn" pill. */
    pill: 'bg-pilot text-white',
    /** Seat buttons before take-off: outlined, solid once it is your seat. */
    seatButton: 'border-pilot text-pilot hover:bg-pilot-soft',
    seatButtonOn: 'border-pilot bg-pilot text-white',
    /** Ability cards before take-off: your pick, and (faded) your partner's. */
    pick: 'border-pilot bg-pilot-soft',
    partnerPick: 'border-pilot/60 bg-pilot-soft/60',
    /** An empty space only this seat may fill. */
    slot: 'border-pilot/60 bg-pilot-soft text-pilot',
  },
  copilot: {
    text: 'text-copilot',
    pill: 'bg-copilot text-white',
    seatButton: 'border-copilot text-copilot hover:bg-copilot-soft',
    seatButtonOn: 'border-copilot bg-copilot text-white',
    pick: 'border-copilot bg-copilot-soft',
    partnerPick: 'border-copilot/60 bg-copilot-soft/60',
    slot: 'border-copilot/70 bg-copilot-soft text-copilot',
  },
} as const satisfies Record<Seat, Record<string, string>>;
