import type { CityId, EventId, HandCard } from '@pandemic/rules';

const files = import.meta.glob<string>('../assets/{player,infection}-cards/*.webp', {
  eager: true,
  import: 'default',
});

const url = (folder: 'player-cards' | 'infection-cards', name: string): string =>
  files[`../assets/${folder}/${name}.webp`] as string;

/** The cities in the order of the card pictures' numbers (`city-0` is San Francisco). */
const PICTURE_ORDER: readonly CityId[] = [
  'san-francisco',
  'chicago',
  'atlanta',
  'montreal',
  'washington',
  'new-york',
  'madrid',
  'london',
  'paris',
  'essen',
  'milan',
  'st-petersburg',
  'los-angeles',
  'mexico-city',
  'lima',
  'santiago',
  'bogota',
  'miami',
  'buenos-aires',
  'sao-paulo',
  'lagos',
  'kinshasa',
  'johannesburg',
  'khartoum',
  'algiers',
  'cairo',
  'istanbul',
  'baghdad',
  'riyadh',
  'moscow',
  'tehran',
  'karachi',
  'mumbai',
  'delhi',
  'chennai',
  'kolkata',
  'jakarta',
  'bangkok',
  'beijing',
  'shanghai',
  'hong-kong',
  'ho-chi-minh-city',
  'seoul',
  'taipei',
  'manila',
  'tokyo',
  'osaka',
  'sydney',
];

const EVENT_PICTURES: Record<EventId, string> = {
  airlift: 'event-airlift',
  forecast: 'event-forecast',
  'government-grant': 'event-gov_grant',
  'one-quiet-night': 'event-one_quiet_night',
  'resilient-population': 'event-res_pop',
};

const cityNumber = (city: CityId): number => PICTURE_ORDER.indexOf(city);

/** The picture of a city's infection card (landscape, 279 × 200). */
export const infectionCardUrl = (city: CityId): string =>
  url('infection-cards', `city-${cityNumber(city)}`);

/** The back of an infection card. */
export const infectionBackUrl = (): string => url('infection-cards', 'back');

/** The picture of a player card (portrait, 208 × 290). */
export const playerCardUrl = (card: HandCard): string =>
  card.kind === 'city'
    ? url('player-cards', `city-${cityNumber(card.city)}`)
    : url('player-cards', EVENT_PICTURES[card.event]);

/** The back of a player card. */
export const playerBackUrl = (): string => url('player-cards', 'back');
