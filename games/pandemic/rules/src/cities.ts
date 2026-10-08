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
  at: readonly [x: number, y: number];
}

/** The size of the map picture the positions were read from. */
const MAP = { width: 1506, height: 703 };

function px(x: number, y: number): readonly [number, number] {
  return [
    Math.round((x / MAP.width) * 10000) / 10000,
    Math.round((y / MAP.height) * 10000) / 10000,
  ];
}

export const CITIES: readonly City[] = [
  // Blue
  {
    id: 'atlanta',
    color: 'blue',
    links: ['chicago', 'washington', 'miami'],
    at: px(392, 262),
  },
  {
    id: 'chicago',
    color: 'blue',
    links: ['san-francisco', 'los-angeles', 'mexico-city', 'atlanta', 'montreal'],
    at: px(338, 212),
  },
  {
    id: 'essen',
    color: 'blue',
    links: ['london', 'paris', 'milan', 'st-petersburg'],
    at: px(758, 165),
  },
  {
    id: 'london',
    color: 'blue',
    links: ['new-york', 'madrid', 'paris', 'essen'],
    at: px(706, 168),
  },
  {
    id: 'madrid',
    color: 'blue',
    links: ['new-york', 'sao-paulo', 'algiers', 'paris', 'london'],
    at: px(695, 212),
  },
  {
    id: 'milan',
    color: 'blue',
    links: ['essen', 'paris', 'istanbul'],
    at: px(768, 192),
  },
  {
    id: 'montreal',
    color: 'blue',
    links: ['chicago', 'washington', 'new-york'],
    at: px(428, 188),
  },
  {
    id: 'new-york',
    color: 'blue',
    links: ['montreal', 'washington', 'london', 'madrid'],
    at: px(452, 218),
  },
  {
    id: 'paris',
    color: 'blue',
    links: ['madrid', 'london', 'essen', 'milan', 'algiers'],
    at: px(725, 180),
  },
  {
    id: 'san-francisco',
    color: 'blue',
    links: ['tokyo', 'manila', 'los-angeles', 'chicago'],
    at: px(205, 220),
  },
  {
    id: 'st-petersburg',
    color: 'blue',
    links: ['essen', 'istanbul', 'moscow'],
    at: px(840, 120),
  },
  {
    id: 'washington',
    color: 'blue',
    links: ['atlanta', 'montreal', 'new-york', 'miami'],
    at: px(435, 240),
  },
  // Yellow
  {
    id: 'bogota',
    color: 'yellow',
    links: ['miami', 'mexico-city', 'lima', 'sao-paulo', 'buenos-aires'],
    at: px(378, 385),
  },
  {
    id: 'buenos-aires',
    color: 'yellow',
    links: ['bogota', 'sao-paulo'],
    at: px(452, 545),
  },
  {
    id: 'johannesburg',
    color: 'yellow',
    links: ['kinshasa', 'khartoum'],
    at: px(810, 520),
  },
  {
    id: 'khartoum',
    color: 'yellow',
    links: ['cairo', 'lagos', 'kinshasa', 'johannesburg'],
    at: px(855, 340),
  },
  {
    id: 'kinshasa',
    color: 'yellow',
    links: ['lagos', 'khartoum', 'johannesburg'],
    at: px(790, 430),
  },
  {
    id: 'lagos',
    color: 'yellow',
    links: ['sao-paulo', 'khartoum', 'kinshasa'],
    at: px(718, 385),
  },
  {
    id: 'lima',
    color: 'yellow',
    links: ['mexico-city', 'bogota', 'santiago'],
    at: px(372, 448),
  },
  {
    id: 'los-angeles',
    color: 'yellow',
    links: ['san-francisco', 'chicago', 'mexico-city', 'sydney'],
    at: px(232, 262),
  },
  {
    id: 'mexico-city',
    color: 'yellow',
    links: ['los-angeles', 'chicago', 'miami', 'bogota', 'lima'],
    at: px(300, 322),
  },
  {
    id: 'miami',
    color: 'yellow',
    links: ['atlanta', 'washington', 'mexico-city', 'bogota'],
    at: px(412, 300),
  },
  {
    id: 'santiago',
    color: 'yellow',
    links: ['lima'],
    at: px(385, 540),
  },
  {
    id: 'sao-paulo',
    color: 'yellow',
    links: ['bogota', 'buenos-aires', 'lagos', 'madrid'],
    at: px(500, 480),
  },
  // Black
  {
    id: 'algiers',
    color: 'black',
    links: ['madrid', 'paris', 'istanbul', 'cairo'],
    at: px(735, 238),
  },
  {
    id: 'baghdad',
    color: 'black',
    links: ['istanbul', 'cairo', 'riyadh', 'karachi', 'tehran'],
    at: px(895, 245),
  },
  {
    id: 'cairo',
    color: 'black',
    links: ['algiers', 'istanbul', 'baghdad', 'riyadh', 'khartoum'],
    at: px(843, 268),
  },
  {
    id: 'chennai',
    color: 'black',
    links: ['mumbai', 'delhi', 'kolkata', 'bangkok', 'jakarta'],
    at: px(1065, 370),
  },
  {
    id: 'delhi',
    color: 'black',
    links: ['tehran', 'karachi', 'mumbai', 'chennai', 'kolkata'],
    at: px(1050, 285),
  },
  {
    id: 'istanbul',
    color: 'black',
    links: ['milan', 'st-petersburg', 'moscow', 'baghdad', 'cairo', 'algiers'],
    at: px(825, 208),
  },
  {
    id: 'karachi',
    color: 'black',
    links: ['tehran', 'baghdad', 'riyadh', 'mumbai', 'delhi'],
    at: px(985, 285),
  },
  {
    id: 'kolkata',
    color: 'black',
    links: ['delhi', 'chennai', 'bangkok', 'hong-kong'],
    at: px(1100, 310),
  },
  {
    id: 'moscow',
    color: 'black',
    links: ['st-petersburg', 'istanbul', 'tehran'],
    at: px(860, 148),
  },
  {
    id: 'mumbai',
    color: 'black',
    links: ['karachi', 'delhi', 'chennai'],
    at: px(1010, 330),
  },
  {
    id: 'riyadh',
    color: 'black',
    links: ['cairo', 'baghdad', 'karachi'],
    at: px(885, 300),
  },
  {
    id: 'tehran',
    color: 'black',
    links: ['moscow', 'baghdad', 'karachi', 'delhi'],
    at: px(940, 235),
  },
  // Red
  {
    id: 'bangkok',
    color: 'red',
    links: ['kolkata', 'chennai', 'jakarta', 'ho-chi-minh-city', 'hong-kong'],
    at: px(1145, 350),
  },
  {
    id: 'beijing',
    color: 'red',
    links: ['shanghai', 'seoul'],
    at: px(1185, 215),
  },
  {
    id: 'ho-chi-minh-city',
    color: 'red',
    links: ['jakarta', 'bangkok', 'hong-kong', 'manila'],
    at: px(1175, 375),
  },
  {
    id: 'hong-kong',
    color: 'red',
    links: ['kolkata', 'bangkok', 'ho-chi-minh-city', 'manila', 'taipei', 'shanghai'],
    at: px(1200, 310),
  },
  {
    id: 'jakarta',
    color: 'red',
    links: ['chennai', 'bangkok', 'ho-chi-minh-city', 'sydney'],
    at: px(1160, 435),
  },
  {
    id: 'manila',
    color: 'red',
    links: ['ho-chi-minh-city', 'hong-kong', 'taipei', 'san-francisco', 'sydney'],
    at: px(1245, 355),
  },
  {
    id: 'osaka',
    color: 'red',
    links: ['tokyo', 'taipei'],
    at: px(1295, 250),
  },
  {
    id: 'seoul',
    color: 'red',
    links: ['beijing', 'shanghai', 'tokyo'],
    at: px(1262, 210),
  },
  {
    id: 'shanghai',
    color: 'red',
    links: ['beijing', 'seoul', 'tokyo', 'taipei', 'hong-kong'],
    at: px(1215, 255),
  },
  {
    id: 'sydney',
    color: 'red',
    links: ['jakarta', 'manila', 'los-angeles'],
    at: px(1310, 540),
  },
  {
    id: 'taipei',
    color: 'red',
    links: ['hong-kong', 'manila', 'osaka', 'shanghai'],
    at: px(1240, 305),
  },
  {
    id: 'tokyo',
    color: 'red',
    links: ['seoul', 'shanghai', 'osaka', 'san-francisco'],
    at: px(1310, 235),
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
