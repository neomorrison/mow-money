// Shared cross-module types. Owned by the orchestrator: modules may ADD optional
// fields in their own section at the bottom of an interface only when unavoidable,
// never rename or remove. Everything in GameState must be JSON-serializable.

export type Id = string;
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'heat';
export type Tone = 'friendly' | 'professional' | 'direct' | 'funny';
export type Frequency = 7 | 14;
export type AddOn = 'bagging' | 'stripes' | 'fertilizer';
export type Provider = 'none' | 'diy' | 'rival' | 'me';
export type HoodKind = 'residential' | 'estate' | 'commercial' | 'park' | 'golf';
export type StaffRole = 'operator' | 'lead' | 'sales' | 'mechanic' | 'office' | 'manager';
export type EquipmentCategory = 'mower' | 'trimmer' | 'blower' | 'vehicle' | 'addon';
export type HouseStyle =
  | 'ranch' | 'colonial' | 'cottage' | 'modern' | 'mansion'
  | 'office' | 'church' | 'school' | 'clubhouse' | 'pavilion';

// ---------------------------------------------------------------- calendar
export interface CalendarInfo {
  day: number;          // absolute day index, 0 = Year 1 Spring day 1 Monday
  year: number;         // 1-based
  season: Season;
  dayOfSeason: number;  // 1-based
  seasonLength: number;
  weekday: number;      // 0 = Monday ... 6 = Sunday
  weekdayName: string;  // 'Mon'
  isWorkday: boolean;   // Mon-Sat
  label: string;        // 'Spring 3, Year 1'
}

// ---------------------------------------------------------------- catalog data
export interface EquipmentSpec {
  id: string;
  name: string;
  category: EquipmentCategory;
  tier: number;
  price: number;
  blurb: string;
  model: string;            // key into ASSETS.models
  thumb?: string;           // key into ASSETS.thumbs
  // mowers
  deckWidth?: number;       // game meters
  speed?: number;           // game m/s at full throttle
  turnRate?: number;        // rad/s
  zeroTurn?: boolean;       // can spin in place
  rideOn?: boolean;
  qualityCap?: number;      // 0-100
  stripe?: number;          // 0-1 base stripe strength
  maxGrassIn?: number;      // above this the grass only gets pushed over
  bagging?: boolean;        // collects clippings (bag capacity below)
  bagCapacityM2?: number;   // m2 of full-height clippings before the bag is full
  mulching?: boolean;       // clippings are finely mulched (no clumps under 5 in)
  fuelGalPerHr?: number;    // 0 for manual/electric
  wearMult?: number;        // blade wear multiplier
  reliability?: number;     // 0-1
  deckHeights?: number[];   // inches available
  transportSize?: number;   // capacity units needed on a vehicle
  loud?: boolean;
  // trimmer / blower
  radius?: number;          // game meters
  // vehicles
  travelSpeedKmh?: number;
  capacity?: number;        // transport units
  seats?: number;
  // unlock gating shown in the shop
  unlock?: { rep?: number; level?: number; hood?: string };
}

export interface ArchetypeSpec {
  id: string;
  label: string;                 // 'Friendly Retiree'
  portraits: string[];           // keys into ASSETS.portraits
  wealthMult: number;
  needMult: number;
  expect: number;                // base quality expectation
  patience: number;              // base negotiation rounds
  anchor: number;                // opening counter as fraction of R
  tone: Record<Tone, -1 | 0 | 1>;
  home: { day: number; evening: number };   // answer probabilities
  prefersFreq: Frequency;
  wantsStripes: number;          // probability the client wants stripes
  addOnAffinity: Partial<Record<AddOn, number>>;
  tipMult: number;
  mowCycle: [number, number];    // DIY mowing cycle days when not a client
  flavor: string;                // one line for the house card
  hoods: string[];               // neighborhood ids where this archetype appears
  weight: number;                // relative spawn weight
}

export interface HoodSpec {
  id: string;
  name: string;
  kind: HoodKind;
  lawnM2: [number, number];
  wealth: [number, number];
  houses: number;
  km: number;                    // distance from HQ
  baseLeads: number;             // organic leads per day at rep 5
  unlock: { rep?: number; clients?: number; vehicle?: boolean; rideOn?: boolean; wideArea?: boolean; gang?: boolean; insurance?: boolean; crews?: number };
  styles: HouseStyle[];
  answerRate: number;            // average for sales reps
  blurb: string;
  bidOnly?: boolean;             // commercial, parks, golf
}

export interface TownSpec { id: string; name: string; branchCost: number; seedSalt: number; blurb: string }

// ---------------------------------------------------------------- world (generated, never saved)
export interface LotSpec {
  w: number;                // lot width (m), along the street (x)
  d: number;                // lot depth (m), away from the street (z)
  style: HouseStyle;
  kind: HoodKind;
}

export interface HouseInfo {
  id: Id;                   // `${townId}.${hoodId}.${index}`
  townId: string;
  hoodId: string;
  index: number;
  street: string;           // 'Maple Ln'
  number: number;           // house number
  address: string;          // '14 Maple Ln'
  mapX: number;             // position in the neighborhood map (m)
  mapZ: number;
  rotation: number;         // radians, facing the street
  lot: LotSpec;
  propertySeed: number;
  lawnM2: number;
  lawnSqft: number;
  hardscapeM2: number;
  ownerName: string;
  archetypeId: string;
  portrait: string;
  wealth: number;
  V: number;                // hidden reservation value per weekly mow
  E: number;                // hidden quality expectation
  patience: number;
  anchor: number;
  wantsStripes: boolean;
  noSoliciting: boolean;
  initialProvider: Provider;
  mowCycle: number;         // DIY cycle in days
  mowPhase: number;         // DIY cycle offset
}

// ---------------------------------------------------------------- saved state
export interface HouseState {
  id: Id;
  h?: number;               // grass height override (inches) when tracked
  hDay?: number;            // day h was last set
  provider?: Provider;      // overrides initialProvider
  coldUntil?: number;       // day index until which pitching is refused
  lastKnockDay?: number;
  leadUntil?: number;       // warm lead expiry day
  leadTrust?: number;       // trust bonus of the lead
  hoaUntil?: number;        // HOA letter pressure expiry
  yardSign?: boolean;
  exClient?: boolean;
  met?: boolean;            // the owner has talked to them (portrait and name revealed on the map)
}

export interface Client {
  id: Id;
  houseId: Id;
  since: number;
  price: number;            // per mow, add-ons included
  freq: Frequency;
  addOns: AddOn[];
  R: number;                // reservation at signing (updated on raises)
  satisfaction: number;     // 0-100
  expectation: number;      // E
  wantsStripes: boolean;
  lastServiceDay: number;   // -1 if never
  nextDueDay: number;
  lastQ: number;            // -1 if never
  bestManualQ: number;      // -1 if never mowed manually
  visits: number;
  totalPaid: number;
  tips: number;
  damages: number;
  assignee: 'owner' | Id;   // owner or crew id
  trial: boolean;           // first job is an unpaid trial
  commercial?: { bidId: Id; weeksLeft: number; lowStreak: number };
  status: 'active' | 'paused';
  history: number[];        // last 8 Q values
  // ---- added for charm tipping (optional so older saves load)
  rapport?: number;         // 0-1 how much they like you personally (charm tips)
  talkDay?: number;         // last day of post-job small talk
  likedTone?: Tone;         // a tone they are known to like (learned from small talk)
}

export interface LostClient { houseId: Id; day: number; reason: string; price: number }

export interface OwnedItem {
  uid: Id;
  specId: string;
  sharpness: number;        // 0-1 (mowers)
  condition: number;        // 0-1
  hours: number;
  boughtDay: number;
  paid: number;
  crewId: Id | null;        // null = with the owner
  broken?: boolean;
}

export interface Employee {
  id: Id;
  name: string;
  portrait: string;
  role: StaffRole;
  wage: number;             // $/h
  skill: number;            // 0-100
  speed: number;            // 0.8-1.2 multiplier
  reliability: number;      // 0-1
  morale: number;           // 0-100
  traits: string[];
  hiredDay: number;
  jobs: number;
  crewId: Id | null;
  assignedHood?: string;    // sales reps
  laidOff?: boolean;        // winter layoff
  lastRaiseDay?: number;
}

export interface Candidate extends Omit<Employee, 'hiredDay' | 'jobs' | 'crewId' | 'morale'> {
  askWage: number;
}

export interface Crew {
  id: Id;
  name: string;
  color: string;
  memberIds: Id[];
  vehicleUid: Id | null;
  mowerUid: Id | null;
  trimmerUid: Id | null;
  blowerUid: Id | null;
  homeHood: string | null;  // preferred neighborhood for dispatch
}

export interface Loan { id: Id; principal: number; balance: number; apr: number; weeklyPayment: number; weeksLeft: number; takenDay: number }

export interface Bid {
  id: Id;
  townId: string;
  hoodId: string;
  houseId: Id;
  title: string;            // 'Pinecrest Office Park, Building C'
  lawnM2: number;
  weeks: number;
  fairPrice: number;
  closesDay: number;
  status: 'open' | 'won' | 'lost' | 'expired';
  myBid?: number;
  winningBid?: number;
  winner?: string;
}

export interface MarketingBuy { id: Id; kind: 'flyers' | 'hangers' | 'newspaper'; townId: string; hoodId: string | null; spend: number; startDay: number; endDay: number }

export interface Rival { id: string; name: string; priceIndex: number; quality: number; color: string; priceWarUntil?: number }

export interface LedgerEntry { day: number; amount: number; cat: LedgerCategory; note: string }
export type LedgerCategory =
  | 'job' | 'tip' | 'sale' | 'loan' | 'other_in'
  | 'fuel' | 'wages' | 'equipment' | 'repair' | 'damage' | 'marketing'
  | 'insurance' | 'loan_payment' | 'tax' | 'branch' | 'other_out';

export interface DaySummary {
  day: number;
  revenue: number;
  expenses: number;
  net: number;
  jobs: number;
  avgQ: number;
  newClients: number;
  lostClients: number;
  cashEnd: number;
  rep: number;
  clients: number;
}

export interface WeatherState {
  today: WeatherKind;
  forecast: WeatherKind[];  // next 3 days
  heatStreak: number;
  drought: boolean;
  fuelPrice: number;
}

export interface OwnerState {
  xp: number;
  level: number;
  skillPoints: number;
  perks: string[];
  minute: number;           // clock, 450..1170
  location: string;         // `${townId}.${hoodId}` or 'hq'
  mowerUid: Id | null;      // equipment the owner carries
  trimmerUid: Id | null;
  blowerUid: Id | null;
  vehicleUid: Id | null;
  jobsToday: number;
}

export interface GameStats {
  jobs: number;
  manualJobs: number;
  revenue: number;
  bestQ: number;
  perfectJobs: number;      // Q >= 95
  deals: number;
  knocks: number;
  m2Mowed: number;
  peakClients: number;
  damages: number;
}

export interface GameState {
  v: number;                // save format version
  seed: number;
  rng: number;              // rng state for the daily sim
  company: { name: string; color: string; foundedDay: number };
  day: number;
  cash: number;
  owner: OwnerState;
  weather: WeatherState;
  ratings: number[];        // recent star ratings, newest last (max 60)
  towns: string[];          // unlocked town ids, home town first
  hoods: string[];          // unlocked hood keys `${townId}.${hoodId}`
  houses: Record<Id, HouseState>;
  clients: Client[];
  lost: LostClient[];       // last 40
  items: OwnedItem[];
  staff: Employee[];
  candidates: Candidate[];
  crews: Crew[];
  loans: Loan[];
  insured: boolean;
  bids: Bid[];
  marketing: MarketingBuy[];
  rivals: Record<string, Rival[]>;   // by town id
  ledger: LedgerEntry[];    // last 30 days of entries
  days: DaySummary[];       // last 120 day summaries
  stats: GameStats;
  achievements: string[];
  flags: Record<string, number | boolean | string>;
  legacy: { points: number; perks: string[]; runs: number };
  nextId: number;
  // ---- added: daily goals (optional so older saves load)
  goals?: { day: number; list: DailyGoal[]; sweep: boolean };
}

export type GoalKind = 'knocks' | 'deals' | 'jobs' | 'quality' | 'tips' | 'stripes' | 'charm' | 'earn';
export interface DailyGoal {
  kind: GoalKind;
  label: string;
  target: number;
  base: number;             // running total at dawn (progress = now - base)
  progress: number;
  reward: number;           // cash
  xp: number;
  done: boolean;
}

// ---------------------------------------------------------------- job tickets (UI view of work due)
export interface JobTicket {
  clientId: Id;
  houseId: Id;
  address: string;
  hoodKey: string;          // `${townId}.${hoodId}`
  hoodName: string;
  ownerName: string;
  portrait: string;
  lawnM2: number;
  grassIn: number;
  price: number;
  dueDay: number;
  daysOverdue: number;      // 0 when due today or within grace
  satisfaction: number;
  assignee: 'owner' | Id;
  canAutopilot: boolean;
  estMinutes: number;       // owner estimate incl. travel from current location
  trial: boolean;
  done: boolean;            // already serviced today
}

// ---------------------------------------------------------------- 3D job contract (sim -> mow -> sim)
export interface MowJobSpec {
  jobId: Id;
  kind: 'mow' | 'leaves' | 'practice';
  clientId: Id | null;
  houseId: Id | null;
  address: string;
  ownerName: string;
  portrait: string;
  lot: LotSpec;
  propertySeed: number;
  grassIn: number;          // average height at arrival
  targetIn: number;         // client preferred cut height
  expectation: number;      // E, used by the live quality preview
  wantsStripes: boolean;
  mower: EquipmentSpec;
  sharpness: number;        // 0-1
  trimmer: EquipmentSpec | null;
  blower: EquipmentSpec | null;
  bagging: boolean;
  striping: boolean;        // striping kit roller attached
  weather: WeatherKind;
  season: Season;
  startMinute: number;      // owner clock at arrival
  timeScale: number;        // game minutes per real second
  wet: boolean;
  leaves: number;           // 0-1 leaf density (fall)
  perks: string[];          // owner perks relevant to controls (quick_feet, edge_master, straight_lines)
  notes: string[];          // client instructions shown before start
  tutorial: boolean;
  companyColor?: string;    // tints materials named "Body" (mowers, yard signs)
  vehicleModel?: string;    // model key of the owner's vehicle parked at the curb
  premiumStripes?: boolean; // the client pays for the premium stripes add-on
  autoStripe?: boolean;     // striping kit or Straight Lines perk: bands lay themselves
}

export interface Damage { kind: 'flowerbed' | 'gnome' | 'sprinkler' | 'toy' | 'fence' | 'other'; label: string; points: number; cost: number }

export interface MowJobResult {
  completed: boolean;       // false = abandoned, nothing is paid
  coverage: number;         // 0-1 lawn cells at or below target + 0.5 in
  evenness: number;         // 0-1 uniformity of the final height
  stripe: number;           // 0-1 straightness and alternation of passes
  trim: number;             // 0-1 edge cells trimmed
  cleanup: number;          // 0-1 hardscape free of clippings and leaves
  clumps: number;           // 0-1 share of lawn with visible clumps
  removedFraction: number;  // average share of blade height removed (for the stress rule)
  damages: Damage[];
  realSeconds: number;
  gameMinutes: number;      // mowing time already converted with timeScale, excluding setup
  areaCutM2: number;
  engineHours: number;
  sharpnessLoss: number;
  cutHeightIn: number;      // deck height used most
}

export interface QualityBreakdown {
  q: number;                // final 0-100
  stars: number;
  parts: { label: string; value: number; max: number }[];   // positive contributions
  penalties: { label: string; points: number }[];
  capped: boolean;
}

export interface JobOutcome {
  clientId: Id;
  q: number;
  breakdown: QualityBreakdown;
  paid: number;
  tip: number;
  satisfactionBefore: number;
  satisfactionAfter: number;
  reaction: string;         // client line
  mood: 'delighted' | 'happy' | 'neutral' | 'unhappy' | 'angry';
  xp: number;
  minutes: number;          // game minutes consumed
  fuelCost: number;
  damageCost: number;
  trialResult?: 'signed' | 'declined';
  events: string[];
  // ---- added for performance tipping
  tipParts?: { label: string; amount: number }[];   // how the tip was earned
  streak?: number;          // consecutive owner jobs that met the client's expectation
  canTalk?: boolean;        // small talk is available on the result screen
}

export interface SmallTalkResult {
  ok: boolean;
  message: string;
  playerLine: string;
  reply: string;
  reaction: 'liked' | 'neutral' | 'disliked';
  tip: number;
  rapport: number;
  satisfaction: number;
}

// ---------------------------------------------------------------- pitch contract
export interface PitchContext {
  house: HouseInfo;
  grassIn: number;
  reputation: number;
  fairPrice: number;        // weekly fair price for this lawn (hint)
  clientsOnStreet: number;
  warmTrust: number;        // lead / referral trust bonus
  provider: Provider;
  rival: Rival | null;
  ecoEquipment: boolean;
  hoa: boolean;
  perks: string[];
  season: Season;
  tutorial: boolean;
  companyName?: string;     // for dialogue placeholders
}

export interface PitchOutcome {
  result: 'deal' | 'trial' | 'rejected' | 'cold' | 'left';
  price?: number;
  freq?: Frequency;
  addOns?: AddOn[];
  R?: number;
  trust?: number;
  rounds: number;
  minutes: number;          // game minutes spent talking
  summary: string;
}

// ---------------------------------------------------------------- end of day
export interface DayReport {
  day: number;              // the day that just ended
  label: string;
  revenue: number;
  expenses: number;
  net: number;
  lines: { cat: LedgerCategory; amount: number; note: string }[];
  jobs: { clientId: Id; address: string; by: string; q: number; paid: number }[];
  missed: { clientId: Id; address: string; reason: string }[];
  newClients: { address: string; price: number; by: string }[];
  lostClients: { address: string; reason: string }[];
  referrals: { address: string; from: string }[];
  staff: { name: string; event: string }[];
  events: string[];
  repBefore: number;
  repAfter: number;
  cashEnd: number;
  weatherTomorrow: WeatherKind;
  seasonChanged: Season | null;
  achievements: string[];
}

// ---------------------------------------------------------------- small results
export interface ActionResult { ok: boolean; message: string }

// ---------------------------------------------------------------- view models returned by the sim for the UI
export interface HouseView {
  info: HouseInfo;
  state: HouseState;
  grassIn: number;
  provider: Provider;
  rival: Rival | null;
  client: Client | null;
  lead: boolean;            // warm lead active
  hoa: boolean;
  cold: boolean;            // refused recently
  canKnock: boolean;
  reason: string;           // why not, or '' when canKnock
}

export interface HoodView {
  key: string;              // `${townId}.${hoodId}`
  spec: HoodSpec;
  townId: string;
  unlocked: boolean;
  lockReason: string;       // '' when unlocked
  clients: number;
  houses: number;
  leads: number;
  travelMinutes: number;    // from the owner's current location with the owner's vehicle
}

export interface TownView { spec: TownSpec; unlocked: boolean; canOpen: boolean; reason: string }

export interface ShopEntry {
  spec: EquipmentSpec;
  price: number;            // after perks
  owned: number;
  canBuy: boolean;
  reason: string;           // lock reason or ''
}

export interface PerkSpec { id: string; tree: 'sales' | 'craft' | 'management'; name: string; blurb: string; requires?: string }
export interface LegacyPerkSpec { id: string; name: string; blurb: string; cost: number }
export interface AchievementSpec { id: string; name: string; blurb: string }

export interface LoanOffer { limit: number; apr: number; terms: number[] }

export interface KnockResult {
  ok: boolean;              // false when the knock could not happen (closed hours, cold, no soliciting)
  answered: boolean;
  minutes: number;
  message: string;          // 'No one answered.' or the reason
  context: PitchContext | null;
}

export interface OwnerLevelInfo { level: number; xp: number; xpForNext: number; xpIntoLevel: number; progress: number; skillPoints: number }

export interface ValuationBreakdown { total: number; annualProfit: number; multiple: number; bookValue: number; cash: number; debt: number; retention: number }

export interface CrewPlan { crewId: Id; jobs: JobTicket[]; minutes: number; capacity: number; ready: boolean; problem: string }
