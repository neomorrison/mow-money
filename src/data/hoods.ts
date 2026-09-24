import type { HoodSpec, TownSpec } from '../core/types';

// Neighborhood templates. Every town reuses these with its own seed salt (docs/DESIGN.md section 13).
export const HOODS: HoodSpec[] = [
  {
    id: 'maple', name: 'Maple Grove', kind: 'residential', lawnM2: [260, 420], wealth: [0.85, 1.1], houses: 48, km: 0.5,
    baseLeads: 0.6, unlock: {}, styles: ['ranch', 'cottage', 'colonial'], answerRate: 0.55,
    blurb: 'Starter homes, small lawns, lots of neighbors to talk to.',
  },
  {
    id: 'oak', name: 'Oak Hills', kind: 'residential', lawnM2: [480, 900], wealth: [1.0, 1.25], houses: 56, km: 3,
    baseLeads: 0.7, unlock: { rep: 3.4, clients: 4 }, styles: ['colonial', 'ranch', 'modern'], answerRate: 0.5,
    blurb: 'Family homes on bigger lots. Busy owners, taller grass.',
  },
  {
    id: 'willow', name: 'Willow Creek Estates', kind: 'estate', lawnM2: [1400, 3000], wealth: [1.3, 1.8], houses: 32, km: 7,
    baseLeads: 0.5, unlock: { rep: 3.9, vehicle: true }, styles: ['colonial', 'modern', 'mansion'], answerRate: 0.45,
    blurb: 'Big properties, bigger expectations.',
  },
  {
    id: 'heritage', name: 'Heritage Hills', kind: 'estate', lawnM2: [2500, 5000], wealth: [1.8, 2.6], houses: 24, km: 12,
    baseLeads: 0.35, unlock: { rep: 4.3, rideOn: true }, styles: ['mansion', 'modern'], answerRate: 0.4,
    blurb: 'Gated estates. Stripes are not optional.',
  },
  {
    id: 'pinecrest', name: 'Pinecrest Business Park', kind: 'commercial', lawnM2: [3000, 6000], wealth: [1, 1], houses: 14, km: 9,
    baseLeads: 0, unlock: { rep: 4.0, insurance: true, crews: 1 }, styles: ['office', 'church', 'school'], answerRate: 0,
    blurb: 'Office lawns on contract. Won by bid.', bidOnly: true,
  },
  {
    id: 'parks', name: 'Civic Parks and Fields', kind: 'park', lawnM2: [8000, 15000], wealth: [1, 1], houses: 8, km: 6,
    baseLeads: 0, unlock: { rep: 4.2, wideArea: true }, styles: ['pavilion'], answerRate: 0,
    blurb: 'Ball fields and parks for the city. Won by bid.', bidOnly: true,
  },
  {
    id: 'links', name: 'Fairway Links Golf Club', kind: 'golf', lawnM2: [20000, 20000], wealth: [1, 1], houses: 1, km: 15,
    baseLeads: 0, unlock: { rep: 4.5, gang: true }, styles: ['clubhouse'], answerRate: 0,
    blurb: 'The fairways. The final boss of lawn care.', bidOnly: true,
  },
];

export const HOOD_BY_ID: Record<string, HoodSpec> = Object.fromEntries(HOODS.map((h) => [h.id, h]));

export const TOWNS: TownSpec[] = [
  { id: 'home', name: 'Maplewood', branchCost: 0, seedSalt: 1, blurb: 'Where it all started.' },
  { id: 'riverside', name: 'Riverside', branchCost: 60000, seedSalt: 2, blurb: 'Across the river, same tall grass.' },
  { id: 'cedar', name: 'Cedar Falls', branchCost: 150000, seedSalt: 3, blurb: 'Fast-growing suburb with money to spend.' },
  { id: 'summit', name: 'Summit Ridge', branchCost: 400000, seedSalt: 4, blurb: 'Hilltop estates and the county club circuit.' },
];

export const TOWN_BY_ID: Record<string, TownSpec> = Object.fromEntries(TOWNS.map((t) => [t.id, t]));

export function hoodKey(townId: string, hoodId: string): string {
  return `${townId}.${hoodId}`;
}
export function splitHoodKey(key: string): { townId: string; hoodId: string } {
  const [townId, hoodId] = key.split('.');
  return { townId, hoodId };
}
