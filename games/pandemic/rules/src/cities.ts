export type Color = 'blue' | 'yellow' | 'black' | 'red';

export const COLORS: readonly Color[] = ['blue', 'yellow', 'black', 'red'];

export type CityId =
  | 'atlanta'
  | 'chicago'
  | 'essen'
  | 'london'
  | 'madrid'
  | 'milan'
  | 'montreal'
  | 'new-york'
  | 'paris'
  | 'san-francisco'
  | 'st-petersburg'
  | 'washington'
  | 'bogota'
  | 'buenos-aires'
  | 'johannesburg'
  | 'khartoum'
  | 'kinshasa'
  | 'lagos'
  | 'lima'
  | 'los-angeles'
  | 'mexico-city'
  | 'miami'
  | 'santiago'
  | 'sao-paulo'
  | 'algiers'
  | 'baghdad'
  | 'cairo'
  | 'chennai'
  | 'delhi'
  | 'istanbul'
  | 'karachi'
  | 'kolkata'
  | 'moscow'
  | 'mumbai'
  | 'riyadh'
  | 'tehran'
  | 'bangkok'
  | 'beijing'
  | 'ho-chi-minh-city'
  | 'hong-kong'
  | 'jakarta'
  | 'manila'
  | 'osaka'
  | 'seoul'
  | 'shanghai'
  | 'sydney'
  | 'taipei'
  | 'tokyo';

export interface City {
  id: CityId;
  color: Color;
  links: readonly CityId[];
}

export const CITIES: readonly City[] = [
  // Blue
  {
    id: 'atlanta',
    color: 'blue',
    links: ['chicago', 'washington', 'miami'],
  },
  {
    id: 'chicago',
    color: 'blue',
    links: ['san-francisco', 'los-angeles', 'mexico-city', 'atlanta', 'montreal'],
  },
  {
    id: 'essen',
    color: 'blue',
    links: ['london', 'paris', 'milan', 'st-petersburg'],
  },
  {
    id: 'london',
    color: 'blue',
    links: ['new-york', 'madrid', 'paris', 'essen'],
  },
  {
    id: 'madrid',
    color: 'blue',
    links: ['new-york', 'sao-paulo', 'algiers', 'paris', 'london'],
  },
  {
    id: 'milan',
    color: 'blue',
    links: ['essen', 'paris', 'istanbul'],
  },
  {
    id: 'montreal',
    color: 'blue',
    links: ['chicago', 'washington', 'new-york'],
  },
  {
    id: 'new-york',
    color: 'blue',
    links: ['montreal', 'washington', 'london', 'madrid'],
  },
  {
    id: 'paris',
    color: 'blue',
    links: ['madrid', 'london', 'essen', 'milan', 'algiers'],
  },
  {
    id: 'san-francisco',
    color: 'blue',
    links: ['tokyo', 'manila', 'los-angeles', 'chicago'],
  },
  {
    id: 'st-petersburg',
    color: 'blue',
    links: ['essen', 'istanbul', 'moscow'],
  },
  {
    id: 'washington',
    color: 'blue',
    links: ['atlanta', 'montreal', 'new-york', 'miami'],
  },
  // Yellow
  {
    id: 'bogota',
    color: 'yellow',
    links: ['miami', 'mexico-city', 'lima', 'sao-paulo', 'buenos-aires'],
  },
  {
    id: 'buenos-aires',
    color: 'yellow',
    links: ['bogota', 'sao-paulo'],
  },
  {
    id: 'johannesburg',
    color: 'yellow',
    links: ['kinshasa', 'khartoum'],
  },
  {
    id: 'khartoum',
    color: 'yellow',
    links: ['cairo', 'lagos', 'kinshasa', 'johannesburg'],
  },
  {
    id: 'kinshasa',
    color: 'yellow',
    links: ['lagos', 'khartoum', 'johannesburg'],
  },
  {
    id: 'lagos',
    color: 'yellow',
    links: ['sao-paulo', 'khartoum', 'kinshasa'],
  },
  {
    id: 'lima',
    color: 'yellow',
    links: ['mexico-city', 'bogota', 'santiago'],
  },
  {
    id: 'los-angeles',
    color: 'yellow',
    links: ['san-francisco', 'chicago', 'mexico-city', 'sydney'],
  },
  {
    id: 'mexico-city',
    color: 'yellow',
    links: ['los-angeles', 'chicago', 'miami', 'bogota', 'lima'],
  },
  {
    id: 'miami',
    color: 'yellow',
    links: ['atlanta', 'washington', 'mexico-city', 'bogota'],
  },
  {
    id: 'santiago',
    color: 'yellow',
    links: ['lima'],
  },
  {
    id: 'sao-paulo',
    color: 'yellow',
    links: ['bogota', 'buenos-aires', 'lagos', 'madrid'],
  },
  // Black
  {
    id: 'algiers',
    color: 'black',
    links: ['madrid', 'paris', 'istanbul', 'cairo'],
  },
  {
    id: 'baghdad',
    color: 'black',
    links: ['istanbul', 'cairo', 'riyadh', 'karachi', 'tehran'],
  },
  {
    id: 'cairo',
    color: 'black',
    links: ['algiers', 'istanbul', 'baghdad', 'riyadh', 'khartoum'],
  },
  {
    id: 'chennai',
    color: 'black',
    links: ['mumbai', 'delhi', 'kolkata', 'bangkok', 'jakarta'],
  },
  {
    id: 'delhi',
    color: 'black',
    links: ['tehran', 'karachi', 'mumbai', 'chennai', 'kolkata'],
  },
  {
    id: 'istanbul',
    color: 'black',
    links: ['milan', 'st-petersburg', 'moscow', 'baghdad', 'cairo', 'algiers'],
  },
  {
    id: 'karachi',
    color: 'black',
    links: ['tehran', 'baghdad', 'riyadh', 'mumbai', 'delhi'],
  },
  {
    id: 'kolkata',
    color: 'black',
    links: ['delhi', 'chennai', 'bangkok', 'hong-kong'],
  },
  {
    id: 'moscow',
    color: 'black',
    links: ['st-petersburg', 'istanbul', 'tehran'],
  },
  {
    id: 'mumbai',
    color: 'black',
    links: ['karachi', 'delhi', 'chennai'],
  },
  {
    id: 'riyadh',
    color: 'black',
    links: ['cairo', 'baghdad', 'karachi'],
  },
  {
    id: 'tehran',
    color: 'black',
    links: ['moscow', 'baghdad', 'karachi', 'delhi'],
  },
  // Red
  {
    id: 'bangkok',
    color: 'red',
    links: ['kolkata', 'chennai', 'jakarta', 'ho-chi-minh-city', 'hong-kong'],
  },
  {
    id: 'beijing',
    color: 'red',
    links: ['shanghai', 'seoul'],
  },
  {
    id: 'ho-chi-minh-city',
    color: 'red',
    links: ['jakarta', 'bangkok', 'hong-kong', 'manila'],
  },
  {
    id: 'hong-kong',
    color: 'red',
    links: ['kolkata', 'bangkok', 'ho-chi-minh-city', 'manila', 'taipei', 'shanghai'],
  },
  {
    id: 'jakarta',
    color: 'red',
    links: ['chennai', 'bangkok', 'ho-chi-minh-city', 'sydney'],
  },
  {
    id: 'manila',
    color: 'red',
    links: ['ho-chi-minh-city', 'hong-kong', 'taipei', 'san-francisco', 'sydney'],
  },
  {
    id: 'osaka',
    color: 'red',
    links: ['tokyo', 'taipei'],
  },
  {
    id: 'seoul',
    color: 'red',
    links: ['beijing', 'shanghai', 'tokyo'],
  },
  {
    id: 'shanghai',
    color: 'red',
    links: ['beijing', 'seoul', 'tokyo', 'taipei', 'hong-kong'],
  },
  {
    id: 'sydney',
    color: 'red',
    links: ['jakarta', 'manila', 'los-angeles'],
  },
  {
    id: 'taipei',
    color: 'red',
    links: ['hong-kong', 'manila', 'osaka', 'shanghai'],
  },
  {
    id: 'tokyo',
    color: 'red',
    links: ['seoul', 'shanghai', 'osaka', 'san-francisco'],
  },
];

const BY_ID = new Map<CityId, City>(CITIES.map((city) => [city.id, city]));

export function cityOf(id: CityId): City {
  const city = BY_ID.get(id);
  if (!city) throw new Error(`Unknown city: ${id}`);
  return city;
}

export function areLinked(a: CityId, b: CityId): boolean {
  return cityOf(a).links.includes(b);
}

/** The white lines that wrap around the edge of the board (Pacific). */
export const PACIFIC_LINKS: readonly (readonly [CityId, CityId])[] = [
  ['san-francisco', 'tokyo'],
  ['san-francisco', 'manila'],
  ['los-angeles', 'sydney'],
];
