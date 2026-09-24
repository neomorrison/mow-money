// Tunable constants for the sim. Numbers mirror docs/DESIGN.md; change both together.
import type { Season, WeatherKind, AddOn, StaffRole } from '../core/types';

export const TIME_SCALE = 0.2;         // game minutes per real second in the 3D job
export const DAY_START = 450;          // 07:30
export const DAY_END = 1170;           // 19:30
export const SETUP_MINUTES = 6;
export const KNOCK_OPEN = 480;         // 08:00
export const KNOCK_EARLY = 540;        // before 09:00 the answer chance is halved
export const EVENING_START = 1020;     // 17:00

export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
export const SEASON_LENGTH: Record<Season, number> = { spring: 28, summer: 28, fall: 28, winter: 14 };
export const YEAR_DAYS = 98;

// ---------------------------------------------------------------- grass (section 4)
export const GROWTH_G: Record<Season, number> = { spring: 0.36, summer: 0.26, fall: 0.22, winter: 0 };
export const GROWTH_W: Record<WeatherKind, number> = { sunny: 1.0, cloudy: 1.1, rain: 1.35, storm: 1.25, heat: 0.55 };
export const FERTILIZER_GROWTH = 1.15;
export const DROUGHT_GROWTH = 0.6;
export const GRASS_MAX = 12;
export const STRESS_THRESHOLD = 0.40;
export const STRESS_POINTS = 60;

// ---------------------------------------------------------------- weather (section 5)
export const WEATHER_KINDS: WeatherKind[] = ['sunny', 'cloudy', 'rain', 'storm', 'heat'];
export const WEATHER_BASE: Record<Season, number[]> = {
  spring: [0.40, 0.28, 0.24, 0.06, 0.02],
  summer: [0.46, 0.18, 0.10, 0.08, 0.18],
  fall: [0.38, 0.32, 0.22, 0.05, 0.03],
  winter: [0.30, 0.50, 0.15, 0.05, 0.00],
};
export const WEATHER_PERSIST = 0.35;
export const WET_PENALTY = 6;
export const WET_SLOWDOWN = 1.15;

// ---------------------------------------------------------------- prices (section 6)
export const ADDON_MULT: Record<AddOn, number> = { bagging: 1.12, stripes: 1.10, fertilizer: 1.08 };
export const BIWEEKLY_MULT = 1.2;
export const KIND_MULT = { residential: 1, estate: 1, commercial: 1.15, park: 1.15, golf: 2.5 } as const;
export const SQFT_PER_M2 = 10.764;

// ---------------------------------------------------------------- equipment (section 12)
export const SHARPEN_COST = 6;
export const SHARPEN_MINUTES = 15;
export const BLADE_WEAR_PER_1000 = 0.05;  // sharpness lost per 1,000 m2 cut (x wearMult)
export const CONDITION_PER_HOUR = 0.002;
export const TRIM_TOOL_MULT: Record<string, number> = { shears: 1.6, trimmer: 1, protrimmer: 0.5 };
export const BLOW_TOOL_MULT: Record<string, number> = { broom: 1.5, blower: 1, backpack: 0.7 };
export const FUEL_START = 3.6;
export const FUEL_MIN = 2.8;
export const FUEL_MAX = 5.2;
export const SAME_HOOD_TRAVEL = 3;

// ---------------------------------------------------------------- satisfaction (section 10)
export const CHURN_WEEK_MAX = 0.6;
export const CHURN_MID = 35;
export const CHURN_SCALE = 7;
export const RIVAL_CHURN_MULT = 1.3;
export const DAMAGE_SATISFACTION = 12;

// ---------------------------------------------------------------- leads and marketing (section 11)
export const LEAD_DAYS = 7;
export const LEAD_TRUST = 0.15;
export const REFERRAL_TRUST = 0.25;
export const MARKETING = {
  flyers: { cost: 80, label: 'Flyers (100)' },
  hangers: { cost: 150, label: 'Door hangers' },
  newspaper: { cost: 400, label: 'Newspaper ad' },
} as const;
export const MARKETING_DAYS = 14;

// ---------------------------------------------------------------- staff (section 14)
export const WAGE_TABLE: Record<StaffRole, { base: number; perSkill: number }> = {
  operator: { base: 15, perSkill: 0.12 },
  lead: { base: 18, perSkill: 0.14 },
  sales: { base: 16, perSkill: 0.12 },
  mechanic: { base: 20, perSkill: 0.12 },
  office: { base: 17, perSkill: 0.10 },
  manager: { base: 30, perSkill: 0.20 },
};
export const PAID_HOURS = 10;
export const CREW_CAPACITY = 600;
export const JOB_AD_COST = 40;
export const SALES_COMMISSION = 0.08;
export const SALES_KNOCKS = 30;
export const CREW_Q_BASE = 58;          // crew mu = base + skill term * skill/100 * moraleFactor
export const CREW_Q_SKILL = 40;
export const SKILL_GROWTH = 0.0005;     // share of the gap to 100 closed per job

// ---------------------------------------------------------------- finance (section 16)
export const INSURANCE_BASE = 30;
export const INSURANCE_PER_EMPLOYEE = 10;
export const DEDUCTIBLE = 100;
export const TAX_RATE = 0.15;
export const BOOK_DECAY_PER_SEASON = 0.92;
export const RESALE = 0.8;
export const LOAN_TERMS = [13, 26, 52];

// ---------------------------------------------------------------- owner (section 17)
export const XP_DEAL = 25;
export const XP_BID = 60;
