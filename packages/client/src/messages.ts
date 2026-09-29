import type { EndReason, ErrorCode, MoveError, Seat } from '@sky/shared';

export const seatName: Record<Seat, string> = { pilot: 'Pilot', copilot: 'Co-pilot' };

const errors: Record<ErrorCode | MoveError, string> = {
  'bad-request': 'That request was not understood.',
  'room-not-found': 'No game with that code.',
  'room-full': 'That game already has two players.',
  'bad-token': 'Your seat could not be restored.',
  'not-in-room': 'You are not in a game.',
  'already-in-room': 'You are already in a game.',
  'not-strategy': 'Dice are already rolled.',
  'game-not-over': 'The game is not over yet.',
  'too-many-rooms': 'You have too many open games. Finish or leave one first.',
  'game-over': 'The game is over.',
  'not-placing': 'Dice are not rolled yet.',
  'not-your-turn': 'Wait for your partner to place a die.',
  'unknown-die': 'That die is not yours.',
  'unknown-slot': 'That space does not exist.',
  'slot-taken': 'That space is taken.',
  'wrong-seat': 'That space is your partner’s.',
  'bad-coffee': 'Invalid coffee amount.',
  'not-enough-coffee': 'Not enough coffee.',
  'value-out-of-range': 'A die must stay between 1 and 6.',
  'value-not-allowed': 'That space needs a different number.',
  'out-of-order': 'Deploy these in order.',
  'no-reroll': 'No reroll tokens left.',
  'reroll-pending': 'A reroll is already under way.',
  'no-reroll-pending': 'You have no reroll to use.',
  'bad-reroll': 'Pick each die at most once.',
};

export const errorText = (code: string): string =>
  errors[code as ErrorCode | MoveError] ?? 'Something went wrong.';

export const endReasonText: Record<EndReason, string> = {
  spin: 'The axis tipped too far: the plane went into a spin.',
  collision: 'You flew into another plane on the approach.',
  overshoot: 'You overshot the airport.',
  'missed-airport': 'You ran out of altitude before reaching the airport.',
  'mandatory-missing': 'A round ended without both axis and both engine dice.',
  'landing-traffic': 'There were still planes on the approach.',
  'landing-gear': 'Not all the landing gear was down.',
  'landing-flaps': 'Not all the flaps were deployed.',
  'landing-axis': 'The plane was not level.',
  'landing-brakes': 'Your speed was too high for the brakes.',
  'time-up': 'Time ran out before all the dice were placed.',
};
