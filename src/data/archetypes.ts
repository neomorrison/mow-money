import type { ArchetypeSpec } from '../core/types';

// Homeowner and site-contact personalities. Numbers feed the formulas in docs/DESIGN.md sections 7 to 10.
// tone: affinity to an opener (-1 dislikes, 0 neutral, +1 likes).
export const ARCHETYPES: ArchetypeSpec[] = [
  {
    id: 'retiree', label: 'Friendly Retiree', portraits: ['p_retiree_1', 'p_retiree_2'],
    wealthMult: 0.95, needMult: 1.08, expect: 72, patience: 5, anchor: 0.78,
    tone: { friendly: 1, professional: 0, direct: -1, funny: 1 },
    home: { day: 0.85, evening: 0.7 }, prefersFreq: 7, wantsStripes: 0.3,
    addOnAffinity: { bagging: 0.4 }, tipMult: 1.3, mowCycle: [8, 14],
    flavor: 'Waves at every car. Knows everyone on the street.',
    hoods: ['maple', 'oak', 'willow'], weight: 10,
  },
  {
    id: 'perfectionist', label: 'Perfectionist', portraits: ['p_perfectionist_1', 'p_perfectionist_2'],
    wealthMult: 1.15, needMult: 1.0, expect: 88, patience: 4, anchor: 0.8,
    tone: { friendly: 0, professional: 1, direct: 0, funny: -1 },
    home: { day: 0.75, evening: 0.7 }, prefersFreq: 7, wantsStripes: 0.9,
    addOnAffinity: { stripes: 0.7, bagging: 0.6 }, tipMult: 0.8, mowCycle: [5, 7],
    flavor: 'Measures the grass with a ruler. Seriously.',
    hoods: ['maple', 'oak', 'willow', 'heritage'], weight: 6,
  },
  {
    id: 'family', label: 'Busy Young Family', portraits: ['p_family_1', 'p_family_2'],
    wealthMult: 0.95, needMult: 1.12, expect: 65, patience: 3, anchor: 0.72,
    tone: { friendly: 1, professional: 0, direct: 1, funny: 1 },
    home: { day: 0.3, evening: 0.8 }, prefersFreq: 7, wantsStripes: 0.2,
    addOnAffinity: {}, tipMult: 1.0, mowCycle: [12, 21],
    flavor: 'Three kids, two jobs, one very tall lawn.',
    hoods: ['maple', 'oak', 'willow'], weight: 10,
  },
  {
    id: 'penny', label: 'Penny-Pincher', portraits: ['p_penny_1', 'p_penny_2'],
    wealthMult: 0.8, needMult: 0.95, expect: 62, patience: 6, anchor: 0.6,
    tone: { friendly: 0, professional: 0, direct: 1, funny: -1 },
    home: { day: 0.7, evening: 0.75 }, prefersFreq: 14, wantsStripes: 0.05,
    addOnAffinity: {}, tipMult: 0.3, mowCycle: [10, 18],
    flavor: 'Still has the receipt for that mailbox from 1994.',
    hoods: ['maple', 'oak'], weight: 7,
  },
  {
    id: 'hoa', label: 'HOA Board Member', portraits: ['p_hoa_1', 'p_hoa_2'],
    wealthMult: 1.1, needMult: 1.15, expect: 84, patience: 3, anchor: 0.78,
    tone: { friendly: -1, professional: 1, direct: 1, funny: -1 },
    home: { day: 0.5, evening: 0.8 }, prefersFreq: 7, wantsStripes: 0.6,
    addOnAffinity: { stripes: 0.4 }, tipMult: 0.6, mowCycle: [6, 9],
    flavor: 'Has opinions about everyone else\'s edges.',
    hoods: ['oak', 'willow', 'heritage'], weight: 5,
  },
  {
    id: 'techie', label: 'Remote Tech Worker', portraits: ['p_techie_1', 'p_techie_2'],
    wealthMult: 1.2, needMult: 1.1, expect: 75, patience: 2, anchor: 0.82,
    tone: { friendly: 0, professional: 1, direct: 1, funny: 0 },
    home: { day: 0.8, evening: 0.6 }, prefersFreq: 7, wantsStripes: 0.3,
    addOnAffinity: { fertilizer: 0.3 }, tipMult: 1.0, mowCycle: [14, 24],
    flavor: 'In a meeting. Always in a meeting.',
    hoods: ['maple', 'oak', 'willow'], weight: 8,
  },
  {
    id: 'gardener', label: 'Gardening Enthusiast', portraits: ['p_gardener_1', 'p_gardener_2'],
    wealthMult: 1.05, needMult: 0.9, expect: 82, patience: 4, anchor: 0.74,
    tone: { friendly: 1, professional: 0, direct: 0, funny: 0 },
    home: { day: 0.8, evening: 0.6 }, prefersFreq: 7, wantsStripes: 0.4,
    addOnAffinity: { fertilizer: 0.7, bagging: 0.5 }, tipMult: 1.1, mowCycle: [6, 10],
    flavor: 'The flower beds are sacred ground.',
    hoods: ['maple', 'oak', 'willow', 'heritage'], weight: 6,
  },
  {
    id: 'eco', label: 'Eco Neighbor', portraits: ['p_eco_1', 'p_eco_2'],
    wealthMult: 1.0, needMult: 1.0, expect: 72, patience: 4, anchor: 0.75,
    tone: { friendly: 1, professional: 0, direct: 0, funny: 1 },
    home: { day: 0.6, evening: 0.7 }, prefersFreq: 14, wantsStripes: 0.1,
    addOnAffinity: {}, tipMult: 1.0, mowCycle: [10, 16],
    flavor: 'Solar panels, rain barrel, strong feelings about gas engines.',
    hoods: ['maple', 'oak'], weight: 5,
  },
  {
    id: 'landlord', label: 'Absentee Landlord', portraits: ['p_landlord_1', 'p_landlord_2'],
    wealthMult: 1.0, needMult: 1.2, expect: 60, patience: 3, anchor: 0.68,
    tone: { friendly: -1, professional: 1, direct: 1, funny: 0 },
    home: { day: 0.15, evening: 0.25 }, prefersFreq: 14, wantsStripes: 0.05,
    addOnAffinity: {}, tipMult: 0.2, mowCycle: [14, 28],
    flavor: 'Rental property. The tenants do not mow.',
    hoods: ['maple', 'oak'], weight: 5,
  },
  {
    id: 'dude', label: 'Laid-Back Dude', portraits: ['p_dude_1', 'p_dude_2'],
    wealthMult: 0.95, needMult: 1.1, expect: 58, patience: 4, anchor: 0.75,
    tone: { friendly: 1, professional: -1, direct: 0, funny: 1 },
    home: { day: 0.6, evening: 0.8 }, prefersFreq: 14, wantsStripes: 0.1,
    addOnAffinity: {}, tipMult: 1.5, mowCycle: [14, 25],
    flavor: 'Hammock in the yard. Lawn up to the hammock.',
    hoods: ['maple', 'oak'], weight: 6,
  },
  {
    id: 'veteran', label: 'Retired Veteran', portraits: ['p_veteran_1', 'p_veteran_2'],
    wealthMult: 1.0, needMult: 1.05, expect: 80, patience: 3, anchor: 0.8,
    tone: { friendly: 0, professional: 1, direct: 1, funny: -1 },
    home: { day: 0.85, evening: 0.7 }, prefersFreq: 7, wantsStripes: 0.7,
    addOnAffinity: { stripes: 0.5 }, tipMult: 1.1, mowCycle: [6, 9],
    flavor: 'Flag out front, lines on the lawn, handshake like a vise.',
    hoods: ['maple', 'oak', 'willow'], weight: 5,
  },
  {
    id: 'newcouple', label: 'New Homeowners', portraits: ['p_newcouple_1', 'p_newcouple_2'],
    wealthMult: 1.05, needMult: 1.1, expect: 70, patience: 4, anchor: 0.72,
    tone: { friendly: 1, professional: 1, direct: 0, funny: 1 },
    home: { day: 0.35, evening: 0.85 }, prefersFreq: 7, wantsStripes: 0.4,
    addOnAffinity: { fertilizer: 0.4 }, tipMult: 1.0, mowCycle: [9, 16],
    flavor: 'Just moved in. They did not know lawns grow this fast.',
    hoods: ['maple', 'oak', 'willow'], weight: 7,
  },
  {
    id: 'executive', label: 'Estate Owner', portraits: ['p_executive_1', 'p_executive_2'],
    wealthMult: 1.25, needMult: 1.0, expect: 90, patience: 3, anchor: 0.82,
    tone: { friendly: 0, professional: 1, direct: -1, funny: -1 },
    home: { day: 0.35, evening: 0.6 }, prefersFreq: 7, wantsStripes: 0.85,
    addOnAffinity: { stripes: 0.8, bagging: 0.7, fertilizer: 0.5 }, tipMult: 1.4, mowCycle: [5, 8],
    flavor: 'The house has a name. The lawn has a reputation.',
    hoods: ['willow', 'heritage'], weight: 8,
  },
  // ------------------------------------------------------------ site contacts for bids
  {
    id: 'facilities', label: 'Facilities Manager', portraits: ['p_facilities_1'],
    wealthMult: 1.0, needMult: 1.0, expect: 80, patience: 3, anchor: 0.8,
    tone: { friendly: 0, professional: 1, direct: 1, funny: -1 },
    home: { day: 1, evening: 0 }, prefersFreq: 7, wantsStripes: 0.5,
    addOnAffinity: {}, tipMult: 0, mowCycle: [7, 7],
    flavor: 'Spreadsheets, contracts, a very specific mowing height.',
    hoods: ['pinecrest'], weight: 1,
  },
  {
    id: 'parks', label: 'Parks Supervisor', portraits: ['p_parks_1'],
    wealthMult: 1.0, needMult: 1.0, expect: 76, patience: 3, anchor: 0.8,
    tone: { friendly: 1, professional: 1, direct: 0, funny: 0 },
    home: { day: 1, evening: 0 }, prefersFreq: 7, wantsStripes: 0.6,
    addOnAffinity: {}, tipMult: 0, mowCycle: [7, 7],
    flavor: 'Six fields, one budget, zero complaints wanted.',
    hoods: ['parks'], weight: 1,
  },
  {
    id: 'greenskeeper', label: 'Head Greenskeeper', portraits: ['p_greenskeeper_1'],
    wealthMult: 1.0, needMult: 1.0, expect: 92, patience: 2, anchor: 0.85,
    tone: { friendly: 0, professional: 1, direct: 1, funny: 0 },
    home: { day: 1, evening: 0 }, prefersFreq: 7, wantsStripes: 1,
    addOnAffinity: {}, tipMult: 0, mowCycle: [3, 3],
    flavor: 'Has not seen a missed blade of grass since 1998.',
    hoods: ['links'], weight: 1,
  },
];

export const ARCHETYPE_BY_ID: Record<string, ArchetypeSpec> = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

// Names by portrait gender so a name always matches the face on the door (see PORTRAIT_GENDER).
export const FEMALE_NAMES = [
  'Rose', 'Linda', 'Maria', 'Jess', 'Victoria', 'Priya', 'Aisha', 'Diane', 'Elena', 'Grace', 'Nina', 'Carmen',
  'Mei', 'Beth', 'Joan', 'Rita', 'Sara', 'Yuki', 'Lena', 'Ruth', 'Ada', 'Irene', 'Leah', 'Tamsin', 'Gloria',
  'Hana', 'Olivia', 'Nadia', 'June', 'Patrice',
];
export const MALE_NAMES = [
  'Harold', 'Gus', 'Dev', 'Brett', 'Walt', 'Chad', 'Tom', 'Ken', 'Marcus', 'Frank', 'Omar', 'Ray', 'Hank',
  'Luis', 'Andre', 'Theo', 'Kofi', 'Dale', 'Pete', 'Hector', 'Vince', 'Jamal', 'Stan', 'Rafael', 'Arjun',
  'Mateo', 'Glen', 'Ivan', 'Curtis', 'Jin',
];
export function firstNameFor(gender: 'f' | 'm' | 'couple' | undefined, pick: <T>(a: readonly T[]) => T): string {
  if (gender === 'f') return pick(FEMALE_NAMES);
  if (gender === 'm') return pick(MALE_NAMES);
  if (gender === 'couple') return `${pick(FEMALE_NAMES)} and ${pick(MALE_NAMES)}`;
  return pick(FIRST_NAMES);
}

export const FIRST_NAMES = [
  'Rose', 'Harold', 'Linda', 'Gus', 'Maria', 'Dev', 'Brett', 'Walt', 'Jess', 'Sam', 'Victoria', 'Chad',
  'Priya', 'Tom', 'Aisha', 'Ken', 'Diane', 'Marcus', 'Elena', 'Frank', 'Grace', 'Omar', 'Nina', 'Ray',
  'Carmen', 'Hank', 'Mei', 'Luis', 'Beth', 'Andre', 'Joan', 'Theo', 'Rita', 'Kofi', 'Sara', 'Dale',
  'Yuki', 'Pete', 'Lena', 'Hector', 'Ruth', 'Vince', 'Ada', 'Jamal', 'Irene', 'Stan', 'Leah', 'Rafael',
];
export const LAST_NAMES = [
  'Albright', 'Finch', 'Vance', 'Tightly', 'Delgado', 'Patel', 'Cole', 'Morrison', 'Parker', 'Nguyen',
  'Ashford', 'Brooks', 'Kim', 'Okafor', 'Reyes', 'Schmidt', 'Hughes', 'Tanaka', 'Rossi', 'Walsh',
  'Bennett', 'Chavez', 'Dubois', 'Ellis', 'Foster', 'Garcia', 'Haddad', 'Ivanov', 'Jensen', 'Khan',
  'Lopez', 'Moreau', 'Novak', 'Ortiz', 'Price', 'Quinn', 'Russo', 'Singh', 'Turner', 'Underwood',
];
export const STREET_NAMES: Record<string, string[]> = {
  maple: ['Maple Ln', 'Birch St', 'Sparrow Ct'],
  oak: ['Oak Hill Dr', 'Acorn Way', 'Ridge Rd'],
  willow: ['Willow Creek Blvd', 'Heron Pl'],
  heritage: ['Heritage Hills Dr', 'Chancellor Way'],
  pinecrest: ['Pinecrest Pkwy'],
  parks: ['Civic Center Dr'],
  links: ['Fairway Dr'],
};
