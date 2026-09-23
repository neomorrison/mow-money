// PUBLIC SIM API. The UI, mow and pitch modules import ONLY from this file (plus pure helpers
// explicitly listed in docs/ARCHITECTURE.md). Owned by the sim builder, who replaces every stub
// body with a real implementation split across src/sim/*.ts. Signatures are the contract:
// do not rename or remove; adding optional parameters or new exports is fine.
//
// Conventions:
// - Functions that change the game mutate `state` in place and return a result object.
//   Callers run store.commit() afterwards.
// - Pure view functions never mutate.
// - All randomness comes from makeRng(state.rng) (advance and write back state.rng) or from
//   hashSeed(...) for world generation, never Math.random().

import type {
  ActionResult, AddOn, AchievementSpec, Bid, CalendarInfo, Client, CrewPlan, DayReport, Frequency,
  GameState, HoodKind, HoodView, HouseInfo, HouseView, Id, JobOutcome, JobTicket, KnockResult,
  LegacyPerkSpec, LoanOffer, MowJobResult, MowJobSpec, OwnerLevelInfo, PerkSpec, PitchOutcome,
  QualityBreakdown, ShopEntry, StaffRole, TownView, ValuationBreakdown,
} from '../core/types';

const todo = (name: string): never => { throw new Error(`sim.${name} is not implemented yet`); };

// ---------------------------------------------------------------- constants
export const TIME_SCALE = 0.2;         // game minutes per real second in the 3D job
export const DAY_START = 450;          // 07:30
export const DAY_END = 1170;           // 19:30
export const SETUP_MINUTES = 6;

// ---------------------------------------------------------------- lifecycle
export function newGame(opts: { companyName: string; color: string; seed?: number; legacyPerks?: string[]; legacyPoints?: number; runs?: number }): GameState { return todo('newGame'); }
/** Upgrade an older save in place and return it (fill new fields with defaults). */
export function migrate(state: GameState): GameState { return state; }

// ---------------------------------------------------------------- calendar and meta
export function calendar(day: number): CalendarInfo { return todo('calendar'); }
export function reputation(state: GameState): number { return todo('reputation'); }
export function ownerLevel(state: GameState): OwnerLevelInfo { return todo('ownerLevel'); }
export function ownerMinutesLeft(state: GameState): number { return todo('ownerMinutesLeft'); }
export function valuation(state: GameState): ValuationBreakdown { return todo('valuation'); }
export const PERKS: PerkSpec[] = [];
export const LEGACY_PERKS: LegacyPerkSpec[] = [];
export const ACHIEVEMENTS: AchievementSpec[] = [];

// ---------------------------------------------------------------- pricing (pure)
export function fairPrice(lawnM2: number, freq: Frequency = 7, kind: HoodKind = 'residential'): number { return todo('fairPrice'); }

// ---------------------------------------------------------------- world views
export function towns(state: GameState): TownView[] { return todo('towns'); }
export function hoods(state: GameState, townId?: string): HoodView[] { return todo('hoods'); }
export function houseInfo(state: GameState, houseId: Id): HouseInfo { return todo('houseInfo'); }
export function housesInHood(state: GameState, hoodKey: string): HouseView[] { return todo('housesInHood'); }
export function houseView(state: GameState, houseId: Id): HouseView { return todo('houseView'); }
export function grassHeight(state: GameState, houseId: Id, day?: number): number { return todo('grassHeight'); }
export function openBranch(state: GameState, townId: string): ActionResult { return todo('openBranch'); }

// ---------------------------------------------------------------- owner movement and time
export function travelTo(state: GameState, hoodKey: string | 'hq'): ActionResult & { minutes: number } { return todo('travelTo'); }
export function travelMinutes(state: GameState, fromKey: string, toKey: string): number { return todo('travelMinutes'); }

// ---------------------------------------------------------------- jobs
export function jobsToday(state: GameState): JobTicket[] { return todo('jobsToday'); }
export function assignJob(state: GameState, clientId: Id, assignee: 'owner' | Id): ActionResult { return todo('assignJob'); }
/** Build the spec for a manual 3D job. Pass clientId null for a free practice lawn. Fails if the owner lacks time or gear. */
export function buildMowJob(state: GameState, clientId: Id | null): MowJobSpec | { error: string } { return todo('buildMowJob'); }
/** Pure quality score used by the results screen and the live HUD preview (docs/DESIGN.md section 9). */
export function computeQuality(spec: MowJobSpec, result: MowJobResult): QualityBreakdown { return todo('computeQuality'); }
/** Apply a finished manual job: pay, satisfaction, wear, fuel, clock, XP, reputation. */
export function completeManualJob(state: GameState, spec: MowJobSpec, result: MowJobResult): JobOutcome { return todo('completeManualJob'); }
/** The player left the 3D job early: advance the clock (travel + setup + result.gameMinutes), apply wear and fuel, no pay, no rating. */
export function abandonManualJob(state: GameState, spec: MowJobSpec, result: MowJobResult): ActionResult { return todo('abandonManualJob'); }
/** Simulated owner job (after one manual job on the property). */
export function autopilotJob(state: GameState, clientId: Id): JobOutcome | { error: string } { return todo('autopilotJob'); }

// ---------------------------------------------------------------- door to door
export function knock(state: GameState, houseId: Id): KnockResult { return todo('knock'); }
export function applyPitchOutcome(state: GameState, houseId: Id, outcome: PitchOutcome): ActionResult & { client: Client | null } { return todo('applyPitchOutcome'); }

// ---------------------------------------------------------------- clients
export function clientById(state: GameState, clientId: Id): Client | undefined { return state.clients.find((c) => c.id === clientId); }
/** Weekly churn probability for display (docs/DESIGN.md section 10). */
export function churnRiskWeekly(state: GameState, client: Client): number { return todo('churnRiskWeekly'); }
export function changePrice(state: GameState, clientId: Id, newPrice: number): ActionResult { return todo('changePrice'); }
export function changeService(state: GameState, clientId: Id, opts: { freq?: Frequency; addOns?: AddOn[] }): ActionResult { return todo('changeService'); }
export function dropClient(state: GameState, clientId: Id): ActionResult { return todo('dropClient'); }
export function askForYardSign(state: GameState, clientId: Id): ActionResult { return todo('askForYardSign'); }

// ---------------------------------------------------------------- equipment
export function shop(state: GameState): ShopEntry[] { return todo('shop'); }
export function buy(state: GameState, specId: string): ActionResult { return todo('buy'); }
export function sell(state: GameState, uid: Id): ActionResult { return todo('sell'); }
export function resaleValue(state: GameState, uid: Id): number { return todo('resaleValue'); }
export function sharpen(state: GameState, uid: Id): ActionResult { return todo('sharpen'); }
export function repair(state: GameState, uid: Id): ActionResult { return todo('repair'); }
/** Put an owned item in the owner's kit (mower, trimmer, blower or vehicle slot by category). */
export function equipOwner(state: GameState, uid: Id): ActionResult { return todo('equipOwner'); }

// ---------------------------------------------------------------- staff and crews
export function marketWage(role: StaffRole, skill: number): number { return todo('marketWage'); }
export function hire(state: GameState, candidateId: Id): ActionResult { return todo('hire'); }
export function fire(state: GameState, employeeId: Id): ActionResult { return todo('fire'); }
export function setWage(state: GameState, employeeId: Id, wage: number): ActionResult { return todo('setWage'); }
export function postJobAd(state: GameState): ActionResult { return todo('postJobAd'); }
export function createCrew(state: GameState, name?: string): ActionResult & { crewId: Id | null } { return todo('createCrew'); }
export function disbandCrew(state: GameState, crewId: Id): ActionResult { return todo('disbandCrew'); }
export function assignToCrew(state: GameState, employeeId: Id, crewId: Id | null): ActionResult { return todo('assignToCrew'); }
export function setCrewGear(state: GameState, crewId: Id, gear: { vehicleUid?: Id | null; mowerUid?: Id | null; trimmerUid?: Id | null; blowerUid?: Id | null }): ActionResult { return todo('setCrewGear'); }
export function setCrewHome(state: GameState, crewId: Id, hoodKey: string | null): ActionResult { return todo('setCrewHome'); }
export function assignSalesHood(state: GameState, employeeId: Id, hoodKey: string): ActionResult { return todo('assignSalesHood'); }
/** Today's plan per crew (what dispatch would do at End Day). */
export function crewPlans(state: GameState): CrewPlan[] { return todo('crewPlans'); }
/** Assign every unassigned due job to crews with spare capacity (the office manager does this each morning). */
export function autoDispatch(state: GameState): ActionResult { return todo('autoDispatch'); }

// ---------------------------------------------------------------- finance
export function loanOffer(state: GameState): LoanOffer { return todo('loanOffer'); }
export function takeLoan(state: GameState, amount: number, weeks: number): ActionResult { return todo('takeLoan'); }
export function repayLoan(state: GameState, loanId: Id, amount: number): ActionResult { return todo('repayLoan'); }
export function setInsurance(state: GameState, on: boolean): ActionResult { return todo('setInsurance'); }
export function buyMarketing(state: GameState, kind: 'flyers' | 'hangers' | 'newspaper', hoodKey: string | null): ActionResult { return todo('buyMarketing'); }
export function financeSummary(state: GameState, lastDays: number): { revenue: number; expenses: number; net: number; byCategory: Record<string, number> } { return todo('financeSummary'); }

// ---------------------------------------------------------------- bids
export function openBids(state: GameState): Bid[] { return todo('openBids'); }
export function placeBid(state: GameState, bidId: Id, amount: number): ActionResult { return todo('placeBid'); }

// ---------------------------------------------------------------- owner progression
export function unlockPerk(state: GameState, perkId: string): ActionResult { return todo('unlockPerk'); }

// ---------------------------------------------------------------- day cycle
/** End the day: crews work, grass grows, payments, churn, referrals, wages, events. Advances to next morning. */
export function endDay(state: GameState): DayReport { return todo('endDay'); }
/** Winter only: fast-forward to spring day 1, returning one combined report. */
export function skipWinter(state: GameState): DayReport { return todo('skipWinter'); }
export function winterLayoff(state: GameState, on: boolean): ActionResult { return todo('winterLayoff'); }

// ---------------------------------------------------------------- legacy
export function canSellCompany(state: GameState): ActionResult { return todo('canSellCompany'); }
/** Returns the legacy points earned. The UI then starts a new game with the legacy carried over. */
export function sellCompany(state: GameState): { points: number; valuation: number } { return todo('sellCompany'); }

// ---------------------------------------------------------------- debug (used by tools and tests)
export const debug = {
  grantCash(state: GameState, amount: number): void { state.cash += amount; },
};
