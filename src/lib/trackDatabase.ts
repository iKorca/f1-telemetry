export interface TrackInfo {
  id: number;
  name: string;
  country: string;
  raceLaps: number;
  circuitLength: number; // km
}

export const TRACK_DATABASE: TrackInfo[] = [
  { id: 0,  name: 'Melbourne',        country: 'Australia',      raceLaps: 58, circuitLength: 5.278 },
  { id: 1,  name: 'Paul Ricard',      country: 'France',         raceLaps: 53, circuitLength: 5.842 },
  { id: 2,  name: 'Shanghai',         country: 'China',          raceLaps: 56, circuitLength: 5.451 },
  { id: 3,  name: 'Bahrain',          country: 'Bahrain',        raceLaps: 57, circuitLength: 5.412 },
  { id: 4,  name: 'Catalunya',        country: 'Spain',          raceLaps: 66, circuitLength: 4.675 },
  { id: 5,  name: 'Monaco',           country: 'Monaco',         raceLaps: 78, circuitLength: 3.337 },
  { id: 6,  name: 'Montreal',         country: 'Canada',         raceLaps: 70, circuitLength: 4.361 },
  { id: 7,  name: 'Silverstone',      country: 'United Kingdom', raceLaps: 52, circuitLength: 5.891 },
  { id: 8,  name: 'Hockenheim',       country: 'Germany',        raceLaps: 67, circuitLength: 4.574 },
  { id: 9,  name: 'Hungaroring',      country: 'Hungary',        raceLaps: 70, circuitLength: 4.381 },
  { id: 10, name: 'Spa',              country: 'Belgium',        raceLaps: 44, circuitLength: 7.004 },
  { id: 11, name: 'Monza',            country: 'Italy',          raceLaps: 53, circuitLength: 5.793 },
  { id: 12, name: 'Singapore',        country: 'Singapore',      raceLaps: 62, circuitLength: 5.063 },
  { id: 13, name: 'Suzuka',           country: 'Japan',          raceLaps: 53, circuitLength: 5.807 },
  { id: 14, name: 'Abu Dhabi',        country: 'UAE',            raceLaps: 58, circuitLength: 5.281 },
  { id: 15, name: 'Austin',           country: 'USA',            raceLaps: 56, circuitLength: 5.513 },
  { id: 16, name: 'Interlagos',       country: 'Brazil',         raceLaps: 71, circuitLength: 4.309 },
  { id: 17, name: 'Austria',          country: 'Austria',        raceLaps: 71, circuitLength: 4.318 },
  { id: 18, name: 'Sochi',            country: 'Russia',         raceLaps: 53, circuitLength: 5.848 },
  { id: 19, name: 'Mexico City',      country: 'Mexico',         raceLaps: 71, circuitLength: 4.304 },
  { id: 20, name: 'Baku',             country: 'Azerbaijan',     raceLaps: 51, circuitLength: 6.003 },
  { id: 21, name: 'Sakhir Short',     country: 'Bahrain',        raceLaps: 87, circuitLength: 3.543 },
  { id: 22, name: 'Silverstone Short', country: 'United Kingdom', raceLaps: 20, circuitLength: 5.891 },
  { id: 23, name: 'Austin Short',     country: 'USA',            raceLaps: 20, circuitLength: 5.513 },
  { id: 24, name: 'Suzuka Short',     country: 'Japan',          raceLaps: 20, circuitLength: 5.807 },
  { id: 25, name: 'Hanoi',            country: 'Vietnam',        raceLaps: 55, circuitLength: 5.613 },
  { id: 26, name: 'Zandvoort',        country: 'Netherlands',    raceLaps: 72, circuitLength: 4.259 },
  { id: 27, name: 'Imola',            country: 'Italy',          raceLaps: 63, circuitLength: 4.909 },
  { id: 28, name: 'Portimao',         country: 'Portugal',       raceLaps: 66, circuitLength: 4.653 },
  { id: 29, name: 'Jeddah',           country: 'Saudi Arabia',   raceLaps: 50, circuitLength: 6.174 },
  { id: 30, name: 'Miami',            country: 'USA',            raceLaps: 57, circuitLength: 5.412 },
  { id: 31, name: 'Las Vegas',        country: 'USA',            raceLaps: 50, circuitLength: 6.201 },
  { id: 32, name: 'Lusail',           country: 'Qatar',          raceLaps: 57, circuitLength: 5.419 },
  { id: 33, name: 'Madrid',           country: 'Spain',          raceLaps: 66, circuitLength: 4.651 },
  { id: 34, name: 'Silverstone Reverse', country: 'United Kingdom', raceLaps: 52, circuitLength: 5.891 },
  { id: 35, name: 'Austria Reverse',     country: 'Austria',        raceLaps: 71, circuitLength: 4.318 },
  { id: 36, name: 'Zandvoort Reverse',   country: 'Netherlands',    raceLaps: 72, circuitLength: 4.259 },
];

const byId = new Map(TRACK_DATABASE.map((t) => [t.id, t]));
const byName = new Map(TRACK_DATABASE.map((t) => [t.name.toLowerCase(), t]));

export function getTrackById(id: number): TrackInfo | undefined {
  return byId.get(id);
}

export function getTrackByName(name: string): TrackInfo | undefined {
  return byName.get(name.toLowerCase());
}

export function getAllTrackNames(): string[] {
  return TRACK_DATABASE.map((t) => t.name);
}

const F1_25_CALENDAR = [
  'Melbourne',
  'Shanghai',
  'Suzuka',
  'Bahrain',
  'Jeddah',
  'Miami',
  'Imola',
  'Monaco',
  'Catalunya',
  'Montreal',
  'Austria',
  'Silverstone',
  'Spa',
  'Hungaroring',
  'Zandvoort',
  'Monza',
  'Baku',
  'Singapore',
  'Austin',
  'Mexico City',
  'Interlagos',
  'Las Vegas',
  'Lusail',
  'Abu Dhabi',
  'Silverstone Reverse',
  'Austria Reverse',
  'Zandvoort Reverse',
];

export function getF125TrackNames(): string[] {
  return F1_25_CALENDAR;
}
