// Game types, state and rules shared by server and client. Filled in during Phase 1.
export type Seat = 'pilot' | 'copilot';

export const SEATS: readonly Seat[] = ['pilot', 'copilot'];
