import type { EquipmentSpec } from '../core/types';

// Game meters and game m/s. Productivity (m2 per game minute) = deckWidth * speed * 0.75 / TIME_SCALE.
// The sim owner may retune numbers (keep ids and model keys stable) and must update docs/DESIGN.md.
export const EQUIPMENT: EquipmentSpec[] = [
  // ------------------------------------------------------------ mowers
  {
    id: 'reel', name: "Grandpa's Reel Mower", category: 'mower', tier: 0, price: 0,
    blurb: 'Quiet, clean cut on short grass. Chokes on anything tall.',
    model: 'mower_reel', thumb: 'mower_reel',
    deckWidth: 1.0, speed: 2.6, turnRate: 2.6, qualityCap: 90, stripe: 0.45, maxGrassIn: 4.5,
    fuelGalPerHr: 0, wearMult: 0.7, reliability: 0.99, deckHeights: [2, 2.5, 3], transportSize: 1,
  },
  {
    id: 'push21', name: 'Gas Push Mower 21"', category: 'mower', tier: 1, price: 280,
    blurb: 'The classic. Handles taller grass and has a side discharge.',
    model: 'mower_push', thumb: 'mower_push',
    deckWidth: 1.2, speed: 3.0, turnRate: 2.4, qualityCap: 85, stripe: 0.3, maxGrassIn: 7,
    mulching: true, fuelGalPerHr: 0.25, wearMult: 1, reliability: 0.95,
    deckHeights: [2, 2.5, 3, 3.5, 4], transportSize: 1, loud: true,
  },
  {
    id: 'selfprop', name: 'Self-Propelled 22" with Bagger', category: 'mower', tier: 2, price: 620,
    blurb: 'Drive wheels, rear roller, rear bag. Clean lawns, light stripes.',
    model: 'mower_selfprop', thumb: 'mower_selfprop',
    deckWidth: 1.3, speed: 3.6, turnRate: 2.4, qualityCap: 88, stripe: 0.5, maxGrassIn: 7,
    bagging: true, bagCapacityM2: 140, mulching: true, fuelGalPerHr: 0.3, wearMult: 1, reliability: 0.96,
    deckHeights: [2, 2.5, 3, 3.5, 4], transportSize: 1, loud: true,
  },
  {
    id: 'walkbehind', name: 'Commercial Walk-Behind 36"', category: 'mower', tier: 3, price: 2900,
    blurb: 'Pro deck on a walk-behind frame. Needs a truck to haul.',
    model: 'mower_walkbehind', thumb: 'mower_walkbehind',
    deckWidth: 1.8, speed: 4.0, turnRate: 2.0, qualityCap: 90, stripe: 0.6, maxGrassIn: 8,
    mulching: true, fuelGalPerHr: 0.5, wearMult: 1, reliability: 0.96,
    deckHeights: [2, 2.5, 3, 3.5, 4, 4.5], transportSize: 2, loud: true, unlock: { rep: 3.4 },
  },
  {
    id: 'zt48', name: 'Zero-Turn 48"', category: 'mower', tier: 4, price: 5800,
    blurb: 'Ride-on, spins in place. The day your legs retire.',
    model: 'mower_zt48', thumb: 'mower_zt48',
    deckWidth: 2.4, speed: 5.5, turnRate: 3.2, zeroTurn: true, rideOn: true, qualityCap: 88, stripe: 0.4, maxGrassIn: 9,
    mulching: true, fuelGalPerHr: 0.9, wearMult: 1.1, reliability: 0.94,
    deckHeights: [1.5, 2, 2.5, 3, 3.5, 4, 4.5], transportSize: 3, loud: true, unlock: { rep: 3.7 },
  },
  {
    id: 'standon', name: 'Stand-On 52"', category: 'mower', tier: 5, price: 8900,
    blurb: 'Nimble around beds and trees. Pros swear by it.',
    model: 'mower_standon', thumb: 'mower_standon',
    deckWidth: 2.6, speed: 6.0, turnRate: 3.6, zeroTurn: true, rideOn: true, qualityCap: 92, stripe: 0.6, maxGrassIn: 9,
    mulching: true, fuelGalPerHr: 1.0, wearMult: 1, reliability: 0.96,
    deckHeights: [1.5, 2, 2.5, 3, 3.5, 4, 4.5], transportSize: 3, loud: true, unlock: { rep: 4.0 },
  },
  {
    id: 'zt60', name: 'Pro Zero-Turn 60"', category: 'mower', tier: 5, price: 10500,
    blurb: 'Fabricated deck, suspension seat, serious speed.',
    model: 'mower_zt60', thumb: 'mower_zt60',
    deckWidth: 3.0, speed: 6.5, turnRate: 3.2, zeroTurn: true, rideOn: true, qualityCap: 93, stripe: 0.7, maxGrassIn: 10,
    mulching: true, fuelGalPerHr: 1.2, wearMult: 1, reliability: 0.97,
    deckHeights: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], transportSize: 4, loud: true, unlock: { rep: 4.1 },
  },
  {
    id: 'widearea', name: 'Wide-Area Mower 72"', category: 'mower', tier: 6, price: 17500,
    blurb: 'Folding wings for parks and fields.',
    model: 'mower_widearea', thumb: 'mower_widearea',
    deckWidth: 3.8, speed: 7.0, turnRate: 2.4, rideOn: true, qualityCap: 92, stripe: 0.6, maxGrassIn: 10,
    mulching: true, fuelGalPerHr: 1.6, wearMult: 1, reliability: 0.96,
    deckHeights: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], transportSize: 5, loud: true, unlock: { rep: 4.2 },
  },
  {
    id: 'gangreel', name: 'Fairway Gang Reel Tractor', category: 'mower', tier: 7, price: 48000,
    blurb: 'Five reels, golf course finish, stripes you can see from space.',
    model: 'mower_gangreel', thumb: 'mower_gangreel',
    deckWidth: 6.0, speed: 6.5, turnRate: 1.8, rideOn: true, qualityCap: 98, stripe: 1.0, maxGrassIn: 5,
    fuelGalPerHr: 2.2, wearMult: 0.8, reliability: 0.97,
    deckHeights: [0.5, 0.75, 1, 1.5, 2, 2.5, 3], transportSize: 8, loud: true, unlock: { rep: 4.5 },
  },
  // ------------------------------------------------------------ trimmers
  {
    id: 'shears', name: 'Hand Shears', category: 'trimmer', tier: 0, price: 0,
    blurb: 'Slow and tiny, but they get the job done.',
    model: 'tool_shears', thumb: 'tool_shears', radius: 0.35, speed: 1.2, fuelGalPerHr: 0, reliability: 1,
  },
  {
    id: 'trimmer', name: 'String Trimmer', category: 'trimmer', tier: 1, price: 140,
    blurb: 'Edges, fence lines, tree rings.',
    model: 'tool_trimmer', thumb: 'tool_trimmer', radius: 0.55, speed: 2.2, fuelGalPerHr: 0.08, reliability: 0.97, loud: true,
  },
  {
    id: 'protrimmer', name: 'Pro Trimmer and Edger', category: 'trimmer', tier: 3, price: 420,
    blurb: 'Wider swath and a crisp edge along concrete.',
    model: 'tool_trimmer_pro', thumb: 'tool_trimmer_pro', radius: 0.75, speed: 2.8, fuelGalPerHr: 0.1, reliability: 0.98, loud: true,
  },
  // ------------------------------------------------------------ blowers
  {
    id: 'broom', name: 'Push Broom', category: 'blower', tier: 0, price: 0,
    blurb: 'Sweeps clippings off the driveway. Slowly.',
    model: 'tool_broom', thumb: 'tool_broom', radius: 0.6, speed: 1.4, fuelGalPerHr: 0, reliability: 1,
  },
  {
    id: 'blower', name: 'Handheld Blower', category: 'blower', tier: 1, price: 120,
    blurb: 'Clears walks and drives in seconds.',
    model: 'tool_blower', thumb: 'tool_blower', radius: 1.4, speed: 2.4, fuelGalPerHr: 0.06, reliability: 0.97, loud: true,
  },
  {
    id: 'backpack', name: 'Backpack Blower', category: 'blower', tier: 3, price: 460,
    blurb: 'Leaf season hero. Huge air, huge range.',
    model: 'tool_backpack', thumb: 'tool_backpack', radius: 2.6, speed: 2.8, fuelGalPerHr: 0.12, reliability: 0.98, loud: true,
  },
  // ------------------------------------------------------------ vehicles
  {
    id: 'bike', name: 'Bicycle and Cart', category: 'vehicle', tier: 0, price: 0,
    blurb: 'Tows one push mower. Great cardio.',
    model: 'veh_bike', thumb: 'veh_bike', travelSpeedKmh: 14, capacity: 1, seats: 1, reliability: 1,
  },
  {
    id: 'pickup', name: 'Used Pickup', category: 'vehicle', tier: 2, price: 7200,
    blurb: '180,000 miles and a good attitude. Bed fits a walk-behind.',
    model: 'veh_pickup', thumb: 'veh_pickup', travelSpeedKmh: 42, capacity: 2, seats: 2, fuelGalPerHr: 1.5, reliability: 0.95,
  },
  {
    id: 'pickup_trailer', name: 'Pickup and 12 ft Trailer', category: 'vehicle', tier: 3, price: 10800,
    blurb: 'Hauls a zero-turn plus the push gear.',
    model: 'veh_pickup_trailer', thumb: 'veh_pickup_trailer', travelSpeedKmh: 40, capacity: 6, seats: 2, fuelGalPerHr: 1.8, reliability: 0.96,
    unlock: { rep: 3.6 },
  },
  {
    id: 'crewtruck', name: 'Crew Cab Truck and 16 ft Trailer', category: 'vehicle', tier: 5, price: 32000,
    blurb: 'Four seats, two riders, every tool on the wall.',
    model: 'veh_crewtruck', thumb: 'veh_crewtruck', travelSpeedKmh: 45, capacity: 10, seats: 4, fuelGalPerHr: 2.2, reliability: 0.97,
    unlock: { rep: 4.0 },
  },
  {
    id: 'boxtruck', name: 'Box Truck', category: 'vehicle', tier: 6, price: 54000,
    blurb: 'Rolling shop for the big contracts.',
    model: 'veh_boxtruck', thumb: 'veh_boxtruck', travelSpeedKmh: 44, capacity: 14, seats: 3, fuelGalPerHr: 2.8, reliability: 0.97,
    unlock: { rep: 4.2 },
  },
  // ------------------------------------------------------------ add-ons (owned once, apply to the owner's kit)
  {
    id: 'stripekit', name: 'Striping Roller Kit', category: 'addon', tier: 2, price: 320,
    blurb: '+0.25 stripe strength on any mower.',
    model: 'addon_stripekit', thumb: 'addon_stripekit',
  },
  {
    id: 'sharpener', name: 'Blade Sharpening Station', category: 'addon', tier: 2, price: 450,
    blurb: 'Blades sharpened overnight for free.',
    model: 'addon_sharpener', thumb: 'addon_sharpener',
  },
  {
    id: 'bagger', name: 'Bagging Attachment', category: 'addon', tier: 1, price: 180,
    blurb: 'Adds a bag to any push or walk-behind mower.',
    model: 'addon_bagger', thumb: 'addon_bagger',
  },
];

export const EQUIPMENT_BY_ID: Record<string, EquipmentSpec> = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));

export function spec(id: string): EquipmentSpec {
  const s = EQUIPMENT_BY_ID[id];
  if (!s) throw new Error(`Unknown equipment ${id}`);
  return s;
}
