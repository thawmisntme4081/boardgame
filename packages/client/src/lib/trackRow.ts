/**
 * Both tracks share one scale: a row fits this many spaces, so altitude and approach cards
 * are the same size whatever the track length (longer tracks shrink to fit the row).
 */
export const TRACK_ROW_SPACES = 8;

/** CSS width of a track with `spaces` spaces, as a share of its row. */
export const trackWidth = (spaces: number): string =>
  `${(Math.min(spaces, TRACK_ROW_SPACES) / TRACK_ROW_SPACES) * 100}%`;
