// Achievements. checkAchievements awards anything newly earned and returns the new ids.
import type { AchievementSpec, GameState } from '../core/types';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import { reputation } from './reputation';
import { HOODS } from '../data/hoods';

export const ACHIEVEMENTS: AchievementSpec[] = [
  { id: 'first_client', name: 'Open for Business', blurb: 'Sign your first client.' },
  { id: 'first_five_star', name: 'Five Stars', blurb: 'Finish a job with a 5-star rating.' },
  { id: 'perfect_lawn', name: 'Perfect Lawn', blurb: 'Score 98 or better on a job.' },
  { id: 'first_tip', name: 'Much Appreciated', blurb: 'Get your first tip.' },
  { id: 'clients_10', name: 'Word Gets Around', blurb: 'Have 10 clients at once.' },
  { id: 'clients_50', name: 'Talk of the Town', blurb: 'Have 50 clients at once.' },
  { id: 'clients_200', name: 'Lawn Empire', blurb: 'Have 200 clients at once.' },
  { id: 'first_gas', name: 'Pull Start', blurb: 'Buy a gas mower.' },
  { id: 'first_truck', name: 'Truck Life', blurb: 'Buy your first truck.' },
  { id: 'first_zero_turn', name: 'Legs Retired', blurb: 'Buy a zero-turn mower.' },
  { id: 'first_hire', name: 'Boss Mode', blurb: 'Hire your first employee.' },
  { id: 'first_crew', name: 'Crew Up', blurb: 'Put a crew to work.' },
  { id: 'jobs_100', name: 'Hundred Lawns', blurb: 'Complete 100 jobs.' },
  { id: 'jobs_1000', name: 'Thousand Lawns', blurb: 'Complete 1,000 jobs.' },
  { id: 'knocks_100', name: 'Knuckles of Steel', blurb: 'Knock on 100 doors.' },
  { id: 'cash_10k', name: 'Five Figures', blurb: 'Earn $10,000 in total revenue.' },
  { id: 'cash_100k', name: 'Six Figures', blurb: 'Earn $100,000 in total revenue.' },
  { id: 'cash_1m', name: 'Millionaire Mower', blurb: 'Earn $1,000,000 in total revenue.' },
  { id: 'rep_45', name: 'Local Legend', blurb: 'Reach 4.5 reputation.' },
  { id: 'level_10', name: 'Seasoned Pro', blurb: 'Reach owner level 10.' },
  { id: 'bid_won', name: 'Under Contract', blurb: 'Win a commercial bid.' },
  { id: 'golf_contract', name: 'Fairway Finish', blurb: 'Win the golf course contract.' },
  { id: 'all_hoods', name: 'Every Street', blurb: 'Unlock every neighborhood in Maplewood.' },
  { id: 'loan_paid', name: 'Debt Free', blurb: 'Pay off a loan.' },
  { id: 'survive_winter', name: 'Snowed In', blurb: 'Make it to your second spring.' },
  { id: 'branch_opened', name: 'Expansion', blurb: 'Open a branch in a new town.' },
  { id: 'sold_company', name: 'Exit Strategy', blurb: 'Sell the company.' },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementSpec> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

function owns(state: GameState, pred: (id: string) => boolean): boolean {
  return state.items.some((i) => pred(i.specId));
}

export function checkAchievements(state: GameState): string[] {
  const s = state.stats;
  const n = state.clients.length;
  if (n > s.peakClients) s.peakClients = n;
  const tests: Record<string, () => boolean> = {
    first_client: () => s.deals > 0 || n > 0,
    first_five_star: () => s.bestQ >= 90,
    perfect_lawn: () => s.bestQ >= 98,
    first_tip: () => Number(state.flags.tips) > 0,
    clients_10: () => s.peakClients >= 10,
    clients_50: () => s.peakClients >= 50,
    clients_200: () => s.peakClients >= 200,
    first_gas: () => owns(state, (id) => { const e = EQUIPMENT_BY_ID[id]; return e?.category === 'mower' && (e.fuelGalPerHr ?? 0) > 0; }),
    first_truck: () => owns(state, (id) => { const e = EQUIPMENT_BY_ID[id]; return e?.category === 'vehicle' && id !== 'bike'; }),
    first_zero_turn: () => owns(state, (id) => !!EQUIPMENT_BY_ID[id]?.zeroTurn),
    first_hire: () => state.staff.length > 0 || Number(state.flags.hires) > 0,
    first_crew: () => Number(state.flags.crewJobs) > 0,
    jobs_100: () => s.jobs >= 100,
    jobs_1000: () => s.jobs >= 1000,
    knocks_100: () => s.knocks >= 100,
    cash_10k: () => s.revenue >= 10_000,
    cash_100k: () => s.revenue >= 100_000,
    cash_1m: () => s.revenue >= 1_000_000,
    rep_45: () => state.ratings.length >= 10 && reputation(state) >= 4.5,
    level_10: () => state.owner.level >= 10,
    bid_won: () => Number(state.flags.bidsWon) > 0,
    golf_contract: () => Number(state.flags.golfContract) > 0,
    all_hoods: () => HOODS.every((h) => state.hoods.includes(`home.${h.id}`)),
    loan_paid: () => Number(state.flags.loansRepaid) > 0,
    survive_winter: () => state.day >= 98,
    branch_opened: () => state.towns.length > 1,
    sold_company: () => !!state.flags.sold,
  };
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    const t = tests[a.id];
    if (t && t()) { state.achievements.push(a.id); out.push(a.id); }
  }
  return out;
}
