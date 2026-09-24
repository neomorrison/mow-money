// PUBLIC SIM API. The UI, mow and pitch modules import ONLY from this file (plus pure helpers
// explicitly listed in docs/ARCHITECTURE.md). Implementations live in the focused files next to it.
// Signatures are the contract: do not rename or remove; adding optional parameters or new exports is fine.
//
// Conventions:
// - Functions that change the game mutate `state` in place and return a result object.
//   Callers run store.commit() afterwards.
// - Pure view functions never mutate.
// - All randomness comes from makeRng(state.rng) (advance and write back state.rng) or from
//   hashSeed(...) for world generation, never Math.random().

import type { Client, GameState, Id, MowJobResult, MowJobSpec } from '../core/types';
import { clamp } from '../core/rng';
import { computeQuality } from './quality';
import { workMinutes } from './kit';
import { BLADE_WEAR_PER_1000 } from './constants';

// ---------------------------------------------------------------- constants
export { TIME_SCALE, DAY_START, DAY_END, SETUP_MINUTES, BLADE_WEAR_PER_1000 } from './constants';

// ---------------------------------------------------------------- lifecycle
export { newGame, migrate } from './newgame';

// ---------------------------------------------------------------- calendar and meta
export { calendar, seasonLabel } from './calendar';
export { reputation, starsFor } from './reputation';
export { ownerLevel, ownerMinutesLeft, PERKS, unlockPerk } from './owner';
export { valuation, financeSummary, loanOffer, takeLoan, repayLoan, setInsurance, insuranceWeekly, debt } from './finance';
export { LEGACY_PERKS, canSellCompany, sellCompany, legacyPointsFor } from './legacy';
export { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from './achievements';

// ---------------------------------------------------------------- pricing (pure)
export { fairPrice, serviceMult, addOnMult, leafCleanupPrice } from './pricing';

// ---------------------------------------------------------------- world views
export {
  towns, hoods, houseInfo, housesInHood, houseView, grassHeight, openBranch, travelTo, travelMinutes,
  siteName, streetsOf, preferredHeight, TUTORIAL_HOUSE,
} from './world';

// ---------------------------------------------------------------- jobs
export { jobsToday, assignJob, buildMowJob, completeManualJob, abandonManualJob, autopilotJob } from './jobs';
export { computeQuality, stripeBonus } from './quality';

// ---------------------------------------------------------------- door to door
export { knock, applyPitchOutcome, answerChance, knockMinutes, pitchContext } from './knock';
export { smallTalk, canSmallTalk, TONES } from './smalltalk';

// ---------------------------------------------------------------- clients
export function clientById(state: GameState, clientId: Id): Client | undefined { return state.clients.find((c) => c.id === clientId); }
export { churnRiskWeekly, changePrice, changeService, dropClient, askForYardSign, hWeek } from './clients';

// ---------------------------------------------------------------- equipment
export { shop, buy, sell, resaleValue, sharpen, repair, repairCost, equipOwner, bookValue } from './shop';

// ---------------------------------------------------------------- staff and crews
export { marketWage, hire, fire, setWage, postJobAd, assignSalesHood, ROLE_LABEL, TRAITS } from './staff';
export { createCrew, disbandCrew, assignToCrew, setCrewGear, setCrewHome, crewPlans, autoDispatch } from './crews';

// ---------------------------------------------------------------- marketing and bids
export { buyMarketing, marketingBoost, openBids, placeBid } from './market';

// ---------------------------------------------------------------- day cycle
export { endDay, skipWinter, winterLayoff } from './day';

// ---------------------------------------------------------------- debug (used by tools and tests)
export const debug = {
  grantCash(state: GameState, amount: number): void { state.cash += amount; },
  setDay(state: GameState, day: number): void { state.day = Math.max(0, Math.floor(day)); },
  /**
   * A plausible MowJobResult for a spec that scores close to `targetQ` (bots, tests, harness pages).
   * Scales coverage and finish together; uses the productivity formula for the time taken.
   */
  syntheticResult(spec: MowJobSpec, targetQ: number, opts: { damages?: MowJobResult['damages'] } = {}): MowJobResult {
    const lawn = Math.max(50, spec.lot.w * spec.lot.d * 0.62);
    const cut = spec.targetIn;
    const removed = spec.grassIn > 0 ? Math.max(0, 1 - cut / spec.grassIn) : 0;
    const make = (t: number): MowJobResult => ({
      completed: true, coverage: clamp(0.8 + 0.2 * t, 0, 1), evenness: clamp(0.5 + 0.5 * t, 0, 1), stripe: clamp(0.3 + 0.7 * t, 0, 1),
      trim: clamp(0.4 + 0.6 * t, 0, 1), cleanup: clamp(0.5 + 0.5 * t, 0, 1), clumps: clamp(0.3 * (1 - t), 0, 1),
      removedFraction: Math.min(removed, 0.4), damages: opts.damages ?? [], realSeconds: 0, gameMinutes: 0, areaCutM2: 0,
      engineHours: 0, sharpnessLoss: 0, cutHeightIn: cut,
    });
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (computeQuality(spec, make(mid)).q < targetQ) lo = mid; else hi = mid;
    }
    const r = make(hi);
    const t = workMinutes({ lawnM2: lawn, hardscapeM2: lawn * 0.08, grassIn: spec.grassIn, mower: spec.mower, trimmer: spec.trimmer, blower: spec.blower, wet: spec.wet });
    r.gameMinutes = Math.round(t.total);
    r.realSeconds = Math.round(t.total / spec.timeScale);
    r.areaCutM2 = Math.round(lawn * r.coverage);
    r.engineHours = Math.round((t.mow / 60) * 1000) / 1000;
    r.sharpnessLoss = Math.round(BLADE_WEAR_PER_1000 * (spec.mower.wearMult ?? 1) * r.areaCutM2 / 1000 * 10000) / 10000;
    return r;
  },
};
