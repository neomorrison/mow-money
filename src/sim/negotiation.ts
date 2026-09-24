// Negotiation engine. OWNED BY THE PITCH BUILDER. Pure and deterministic from a seed.
// Implements docs/DESIGN.md section 8. The pitch UI drives it; the sim never calls the UI.
//
// Model summary (see DESIGN 7 and 8):
//   T0 = 0.35 + 0.10 (rep - 3) + warmTrust + 0.05 min(3, clientsOnStreet) + perks (- 0.10 if a rival serves them)
//   Vf = house.V * need * freqMult * addOnMult
//        house.V  = the sim's reservation value with every DESIGN 7 need multiplier already applied
//                   (archetype needMult, lawn over 5.5 in x1.12, HOA letter x1.2; see sim/knock.ts pitchContext)
//        need     = x1.1 per working overgrown / beat-your-service talking point
//        freqMult = x1.2 for biweekly (taller grass per visit), x0.9 when it is not the preferred frequency
//        addOnMult = product(1 + pct * archetype affinity)   (the offer price gets product(1 + pct))
//   R  = Vf * (0.85 + 0.30 T)                     acceptance is 50 percent at P = R
//   pAccept(r) = 1 / (1 + exp((r - 1) / 0.035))    r = P / R, P includes the full add-on percent
//   counter_k = R (anchor + (0.97 - anchor)(1 - 0.55^k)), whole dollars, strictly rising, never above R
import type { AddOn, Frequency, PitchContext, PitchOutcome, Tone } from '../core/types';
import { ARCHETYPE_BY_ID, ARCHETYPES } from '../data/archetypes';
import { ARCHETYPE_LINES, GENERIC, PLAYER, fill, linesFor, type LineSet, type PointId } from '../data/dialogue';
import { pickFresh } from '../data/pick';
import { makeRng, clamp, type Rng } from '../core/rng';

export type PitchAction =
  | { type: 'opener'; tone: Tone }
  | { type: 'point'; id: string }
  | { type: 'offer'; price: number; freq: Frequency; addOns: AddOn[] }
  | { type: 'accept_counter' }
  | { type: 'trial'; price: number; freq: Frequency; addOns: AddOn[] }
  | { type: 'leave' };

export type Mood = 'offended' | 'steep' | 'close' | 'accept' | 'neutral' | 'pleased';
export type PitchStage = 'opener' | 'points' | 'haggle' | 'done';
export type PitchLine = { who: 'you' | 'them'; text: string };

export interface NegotiationState {
  ctx: PitchContext;
  seed: number;
  trust: number;
  patience: number;
  patienceMax: number;
  round: number;            // offers made so far (k)
  R: number;                // R for the last offer terms (or weekly, no add-ons, before any offer)
  lastCounter: number | null;
  pointsUsed: string[];
  trialUnlocked: boolean;
  done: boolean;
  log: PitchLine[];
  // ---- pitch builder additions
  rngState: number;
  stage: PitchStage;
  tone: Tone | null;
  mood: Mood;
  needMult: number;         // multipliers from talking points (overgrown, beat_current)
  exchanges: number;        // player actions, drives outcome.minutes
  lastTerms: { price: number; freq: Frequency; addOns: AddOn[] } | null;
  counterKey: string | null;  // terms the last counter was made for (counters only rise for the same terms)
  outcome: PitchOutcome | null;
}

export interface PointOption { id: PointId; label: string; hint: string; enabled: boolean; reason: string }

export interface StepResult {
  lines: PitchLine[];
  mood: Mood;
  counter: number | null;
  patience: number;
  done: boolean;
  outcome: PitchOutcome | null;
  effect: 'works' | 'fails' | 'neutral' | null;   // talking point / opener reaction
  finalOffer: boolean;                              // the counter is their last one
}

// ---------------------------------------------------------------- constants
export const ADDON_PCT: Record<AddOn, number> = { bagging: 0.12, stripes: 0.10, fertilizer: 0.08 };
export const ADDON_LABEL: Record<AddOn, string> = { bagging: 'Bagging', stripes: 'Premium stripes', fertilizer: 'Fertilizer program' };
export const ADDONS: AddOn[] = ['bagging', 'stripes', 'fertilizer'];
export const MINUTES_PER_EXCHANGE = 1.5;
export const MAX_POINTS = 2;
export const TONES: Tone[] = ['friendly', 'professional', 'direct', 'funny'];
export const TONE_LABEL: Record<Tone, string> = { friendly: 'Friendly', professional: 'Professional', direct: 'Direct', funny: 'Funny' };
export const POINT_IDS: PointId[] = ['overgrown', 'social_proof', 'reputation', 'free_trial', 'eco', 'beat_current'];
export const POINT_LABEL: Record<PointId, string> = {
  overgrown: 'Your lawn is overgrown',
  social_proof: 'I mow for your neighbors',
  reputation: 'Our reputation',
  free_trial: 'First mow free',
  eco: 'Quiet, clean mowing',
  beat_current: 'Beat your current service',
};
const ECO_BONUS: Record<string, number> = { eco: 0.15, gardener: 0.05, newcouple: 0.03 };
const WEAK_RIVAL_QUALITY = 75;

const FALLBACK_ARCH = ARCHETYPES[0];
const archOf = (ctx: PitchContext) => ARCHETYPE_BY_ID[ctx.house.archetypeId] ?? FALLBACK_ARCH;

// ---------------------------------------------------------------- pure math
/** Acceptance probability for r = price / R (DESIGN 8). */
export function pAccept(r: number): number {
  return 1 / (1 + Math.exp((r - 1) / 0.035));
}

/** Price with add-ons applied (what the client pays per mow). */
export function offerTotal(price: number, addOns: AddOn[]): number {
  let m = 1;
  for (const a of uniq(addOns)) m *= 1 + (ADDON_PCT[a] ?? 0);
  return Math.round(price * m);
}

function uniq<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }

/**
 * Need multiplier from talking points (overgrown, beat your current service). The situational need of
 * DESIGN 7 (lawn over 5.5 in x1.12, HOA letter x1.2) is already folded into ctx.house.V by the sim's
 * pitchContext, so it is not applied again here.
 */
export function needMultiplier(n: NegotiationState): number {
  return n.needMult;
}

/** Situational need (DESIGN 7) for callers that build a PitchContext by hand: multiply house.V by this. */
export function situationalNeed(grassIn: number, hoa: boolean): number {
  return (grassIn > 5.5 ? 1.12 : 1) * (hoa ? 1.2 : 1);
}

export function freqMultiplier(ctx: PitchContext, freq: Frequency): number {
  const a = archOf(ctx);
  return (freq === 14 ? 1.2 : 1) * (freq === a.prefersFreq ? 1 : 0.9);
}

export function addOnMultiplier(ctx: PitchContext, addOns: AddOn[]): number {
  const a = archOf(ctx);
  let m = 1;
  for (const x of uniq(addOns)) m *= 1 + (ADDON_PCT[x] ?? 0) * clamp(a.addOnAffinity[x] ?? 0, 0, 1);
  return m;
}

/** Reservation price R for given terms at the current trust. */
export function reservation(n: NegotiationState, freq: Frequency = 7, addOns: AddOn[] = []): number {
  const v = n.ctx.house.V * needMultiplier(n) * freqMultiplier(n.ctx, freq) * addOnMultiplier(n.ctx, addOns);
  return v * (0.85 + 0.30 * n.trust);
}

/** The going-rate hint for a frequency (neighborhood fair price, before add-ons). */
export function fairHint(ctx: PitchContext, freq: Frequency): number {
  return Math.round(ctx.fairPrice * (freq === 14 ? 1.2 : 1));
}

function initialTrust(ctx: PitchContext): number {
  let t = 0.35 + 0.10 * (ctx.reputation - 3) + Math.max(0, ctx.warmTrust) + 0.05 * Math.min(3, Math.max(0, ctx.clientsOnStreet));
  if (ctx.perks.includes('silver_tongue')) t += 0.08;
  if (ctx.provider === 'rival') t -= 0.10;
  return clamp(t, 0, 1);
}

// ---------------------------------------------------------------- lifecycle
export function createNegotiation(ctx: PitchContext, seed: number): NegotiationState {
  const a = archOf(ctx);
  const patience = Math.max(1, Math.round(ctx.house.patience || a.patience) + (ctx.perks.includes('closer') ? 1 : 0));
  const n: NegotiationState = {
    ctx, seed: seed >>> 0,
    trust: initialTrust(ctx),
    patience, patienceMax: patience,
    round: 0, R: 0, lastCounter: null,
    pointsUsed: [], trialUnlocked: false, done: false, log: [],
    rngState: (seed >>> 0) ^ 0x5bd1e995,
    stage: 'opener', tone: null, mood: 'neutral', needMult: 1, exchanges: 0,
    lastTerms: null, counterKey: null, outcome: null,
  };
  n.R = reservation(n, a.prefersFreq, []);
  const rng = makeRng(n.rngState);
  n.log.push({ who: 'them', text: say(n, pickFresh(rng, themPool(a.id, 'greet'))) });
  n.rngState = rng.state();
  return n;
}

/** Talking points with availability. Empty before the opener and once an offer was made. */
export function availablePoints(n: NegotiationState): PointOption[] {
  const c = n.ctx;
  const used = new Set(n.pointsUsed);
  const full = n.pointsUsed.length >= MAX_POINTS;
  const locked = n.stage !== 'points';
  return POINT_IDS.map((id) => {
    let enabled = true;
    let reason = '';
    let hint = '';
    switch (id) {
      case 'overgrown': hint = `Lawn is at ${c.grassIn.toFixed(1)} in.`; break;
      case 'social_proof':
        hint = c.clientsOnStreet > 0 ? `${c.clientsOnStreet} ${c.clientsOnStreet === 1 ? 'client' : 'clients'} on ${c.house.street}.` : '';
        if (c.clientsOnStreet <= 0) { enabled = false; reason = 'No clients on this street yet.'; }
        break;
      case 'reputation': hint = `${c.reputation.toFixed(1)} stars.`; break;
      case 'free_trial': hint = 'Unlocks a free first mow.'; break;
      case 'eco':
        hint = 'Reel or electric mower.';
        if (!c.ecoEquipment) { enabled = false; reason = 'Needs a reel or electric mower.'; }
        break;
      case 'beat_current':
        hint = c.rival ? `Served by ${c.rival.name}.` : '';
        if (c.provider !== 'rival' || !c.rival) { enabled = false; reason = 'No lawn service to beat.'; }
        break;
    }
    if (used.has(id)) { enabled = false; reason = 'Already said.'; }
    else if (enabled && full) { enabled = false; reason = 'Two points max.'; }
    else if (enabled && locked) { enabled = false; reason = n.stage === 'opener' ? 'Say hello first.' : 'Too late for that.'; }
    return { id, label: POINT_LABEL[id], hint, enabled, reason };
  });
}

/** Mood bucket an offer would get (Read the Room perk). */
export function previewBucket(n: NegotiationState, price: number, freq: Frequency, addOns: AddOn[] = []): Mood {
  const r = offerTotal(price, addOns) / reservation(n, freq, addOns);
  return bucketFor(r);
}

export function bucketFor(r: number): Mood {
  if (r > 1.4) return 'offended';
  if (r > 1.15) return 'steep';
  if (r > 1.0) return 'close';
  if (r > 0.92) return 'accept';
  return 'pleased';
}

/** The counter offer they would make now for round `round` (default: the next rejection). */
export function counterPrice(n: NegotiationState, round?: number): number {
  const a = archOf(n.ctx);
  const k = Math.max(1, round ?? n.round);
  const terms = n.lastTerms ?? { price: 0, freq: a.prefersFreq, addOns: [] as AddOn[] };
  const R = reservation(n, terms.freq, terms.addOns);
  const anchor = clamp(n.ctx.house.anchor || a.anchor, 0.4, 0.97);
  const raw = R * (anchor + (0.97 - anchor) * (1 - Math.pow(0.55, k)));
  let c = Math.round(raw);
  const prev = n.lastCounter !== null && n.counterKey === termsKey(terms.freq, terms.addOns) ? n.lastCounter : null;
  if (prev !== null && c <= prev) c = prev + 1;
  const cap = Math.max(1, Math.floor(R));
  if (c > cap) c = Math.max(cap, prev ?? 0);
  return Math.max(1, c);
}

function termsKey(freq: Frequency, addOns: AddOn[]): string { return freq + ':' + [...addOns].sort().join(','); }

export function currentR(n: NegotiationState): number { return n.R; }

/** The exact line the player will say for an opener tone (the first random draw of the next step). */
export function previewOpener(n: NegotiationState, tone: Tone): string {
  return say(n, makeRng(n.rngState).pick(PLAYER.tone[tone]));
}

/** The exact line the player will say for a talking point. */
export function previewPoint(n: NegotiationState, id: PointId): string {
  return say(n, makeRng(n.rngState).pick(PLAYER.point[id]));
}

// ---------------------------------------------------------------- step
export function step(n: NegotiationState, action: PitchAction): StepResult {
  if (n.done) return result(n, [], null, null, false);
  const rng = makeRng(n.rngState);
  const a = archOf(n.ctx);
  const them1 = (key: ThemKey) => pickFresh(rng, themPool(a.id, key));
  const lines: PitchLine[] = [];
  const you = (t: string, vars: Record<string, string | number> = {}) => lines.push({ who: 'you', text: say(n, t, vars) });
  const them = (t: string, vars: Record<string, string | number> = {}) => lines.push({ who: 'them', text: say(n, t, vars) });
  let effect: StepResult['effect'] = null;
  let counter: number | null = null;
  let finalOffer = false;

  switch (action.type) {
    // ---------------------------------------------------------- opener
    case 'opener': {
      if (n.stage !== 'opener') break;
      n.exchanges++;
      n.tone = action.tone;
      you(rng.pick(PLAYER.tone[action.tone]));
      const aff = a.tone[action.tone] ?? 0;
      n.trust = clamp(n.trust + 0.12 * aff, 0, 1);
      const key = aff > 0 ? 'liked' : aff < 0 ? 'disliked' : 'neutral';
      them(pickFresh(rng, tonePool(a.id, key)));
      effect = aff > 0 ? 'works' : aff < 0 ? 'fails' : 'neutral';
      n.mood = aff > 0 ? 'pleased' : aff < 0 ? 'steep' : 'neutral';
      n.stage = 'points';
      break;
    }
    // ---------------------------------------------------------- talking point
    case 'point': {
      const opt = availablePoints(n).find((p) => p.id === action.id);
      if (!opt || !opt.enabled) break;
      const id = opt.id;
      n.exchanges++;
      n.pointsUsed.push(id);
      you(rng.pick(PLAYER.point[id]));
      effect = applyPoint(n, id, a.id);
      them(pickFresh(rng, pointLines(a.id, id, effect)));
      n.mood = effect === 'works' ? 'pleased' : effect === 'fails' ? 'steep' : 'neutral';
      break;
    }
    // ---------------------------------------------------------- offer / trial
    case 'offer':
    case 'trial': {
      if (n.stage !== 'points' && n.stage !== 'haggle') break;
      if (action.type === 'trial' && !n.trialUnlocked) break;
      const price = Math.max(1, Math.round(action.price));
      const addOns = uniq(action.addOns ?? []).filter((x) => x in ADDON_PCT);
      const freq: Frequency = action.freq === 14 ? 14 : 7;
      const total = offerTotal(price, addOns);
      n.exchanges++;
      n.round++;
      n.stage = 'haggle';
      n.lastTerms = { price, freq, addOns };
      const R = reservation(n, freq, addOns);
      n.R = R;
      const r = total / R;
      if (action.type === 'trial') {
        you(rng.pick(PLAYER.trial), { price: dollars(total) });
      } else {
        const base = rng.pick(freq === 14 ? PLAYER.offerBiweekly : PLAYER.offerWeekly);
        const suffix = addOns.length ? fill(PLAYER.addOnsSuffix, { addons: listAddOns(addOns) }) : '';
        you(base + suffix, { price: dollars(total) });
      }
      // Trials are easier to say yes to: nothing to lose on the first visit.
      const rEff = action.type === 'trial' ? r - 0.10 : r;
      const tutorialSure = n.ctx.tutorial && rEff <= 1.0;
      let accepted = tutorialSure || rng.next() < pAccept(rEff);
      // They would never counter above what you asked: a counter that meets your price means yes.
      if (!accepted) {
        const peek = counterPrice(n, n.round);
        if (peek >= total) accepted = true;
      }
      if (accepted) {
        const kind = action.type === 'trial' ? 'trial' : 'deal';
        them(them1(kind === 'trial' ? 'trial' : 'accept'));
        n.mood = 'accept';
        finish(n, kind, { price: total, freq, addOns, R });
        break;
      }
      // Rejected: reveal the bucket, lose patience, maybe counter.
      const bucket = r > 1.4 ? 'offended' : r > 1.15 ? 'steep' : 'close';
      n.mood = bucket;
      n.patience -= 1;
      if (bucket === 'offended') {
        n.trust = clamp(n.trust - 0.15, 0, 1);
        n.patience -= 1;
      }
      them(them1(bucket));
      if (n.patience <= 0) {
        if (bucket === 'offended') {
          them(them1('slam'));
          finish(n, 'rejected', {});
        } else {
          them(them1('think'));
          finish(n, 'cold', {});
        }
        break;
      }
      counter = counterPrice(n, n.round);
      n.lastCounter = counter;
      n.counterKey = termsKey(freq, addOns);
      n.R = reservation(n, freq, addOns);
      finalOffer = n.patience <= 1;
      them(them1(finalOffer ? 'finalCounter' : 'counter'), { price: dollars(counter) });
      break;
    }
    // ---------------------------------------------------------- accept their counter
    case 'accept_counter': {
      if (n.lastCounter === null || !n.lastTerms) break;
      n.exchanges++;
      const price = n.lastCounter;
      you(rng.pick(PLAYER.acceptCounter), { price: dollars(price) });
      them(them1('accept'));
      n.mood = 'accept';
      finish(n, 'deal', { price, freq: n.lastTerms.freq, addOns: n.lastTerms.addOns, R: reservation(n, n.lastTerms.freq, n.lastTerms.addOns) });
      break;
    }
    // ---------------------------------------------------------- walk away
    case 'leave': {
      n.exchanges++;
      you(rng.pick(PLAYER.walkAway));
      them(them1('walkAway'));
      finish(n, 'left', {});
      break;
    }
  }

  n.rngState = rng.state();
  n.log.push(...lines);
  return result(n, lines, counter, effect, finalOffer);
}

// ---------------------------------------------------------------- helpers
function applyPoint(n: NegotiationState, id: PointId, archId: string): 'works' | 'fails' | 'neutral' {
  const c = n.ctx;
  switch (id) {
    case 'overgrown':
      if (c.grassIn > 5) { n.needMult *= 1.1; return 'works'; }
      if (c.grassIn < 4) { n.trust = clamp(n.trust - 0.10, 0, 1); return 'fails'; }
      return 'neutral';
    case 'social_proof': {
      const k = Math.min(3, Math.max(0, c.clientsOnStreet));
      if (k <= 0) return 'neutral';
      n.trust = clamp(n.trust + 0.08 * k, 0, 1);
      return 'works';
    }
    case 'reputation': {
      const d = 0.06 * (c.reputation - 3.5);
      n.trust = clamp(n.trust + d, 0, 1);
      return d > 0.005 ? 'works' : d < -0.005 ? 'fails' : 'neutral';
    }
    case 'free_trial':
      n.trialUnlocked = true;
      return 'works';
    case 'eco': {
      const b = ECO_BONUS[archId] ?? 0;
      n.trust = clamp(n.trust + b, 0, 1);
      return b > 0 ? 'works' : 'neutral';
    }
    case 'beat_current':
      if (c.rival && c.rival.quality < WEAK_RIVAL_QUALITY) { n.needMult *= 1.1; return 'works'; }
      return 'fails';
  }
}

type ThemKey = Exclude<keyof LineSet, 'tone' | 'point'>;

/** Character lines weigh double; the generic pool adds variety so nobody repeats themselves every visit. */
function merged(own: readonly string[] | undefined, gen: readonly string[] | undefined): string[] {
  const o = own ?? [];
  const g = gen ?? [];
  return o.length ? [...o, ...o, ...g] : [...g];
}

function themPool(archId: string, key: ThemKey): string[] {
  const out = merged(ARCHETYPE_LINES[archId]?.[key] as string[] | undefined, GENERIC[key] as string[]);
  return out.length ? out : ['...'];
}

function tonePool(archId: string, key: 'liked' | 'neutral' | 'disliked'): string[] {
  return merged(ARCHETYPE_LINES[archId]?.tone?.[key], GENERIC.tone[key]);
}

function pointLines(archId: string, id: PointId, effect: 'works' | 'fails' | 'neutral'): string[] {
  const own = ARCHETYPE_LINES[archId]?.point?.[id];
  const gen = GENERIC.point[id];
  const meh = merged(ARCHETYPE_LINES[archId]?.pointMeh, GENERIC.pointMeh);
  if (effect === 'neutral') {
    // Eco talk that doesn't move a non-eco person reads as a shrug, as does a so-so lawn.
    return own?.fails?.length && id === 'eco' ? merged(own.fails, gen?.fails) : meh;
  }
  const pool = effect === 'works' ? merged(own?.works, gen?.works) : merged(own?.fails, gen?.fails);
  return pool.length ? pool : meh;
}

function finish(n: NegotiationState, kind: PitchOutcome['result'], deal: { price?: number; freq?: Frequency; addOns?: AddOn[]; R?: number }): void {
  n.done = true;
  n.stage = 'done';
  const minutes = Math.round(MINUTES_PER_EXCHANGE * Math.max(1, n.exchanges) * 10) / 10;
  const o: PitchOutcome = { result: kind, rounds: n.round, minutes, summary: '' };
  if (kind === 'deal' || kind === 'trial') {
    o.price = deal.price;
    o.freq = deal.freq;
    o.addOns = deal.addOns ?? [];
    o.R = Math.round((deal.R ?? n.R) * 100) / 100;
    o.trust = Math.round(n.trust * 1000) / 1000;
    const f = deal.freq === 14 ? 'every two weeks' : 'weekly';
    o.summary = kind === 'deal'
      ? `Signed at ${dollars(deal.price ?? 0)} ${f}.`
      : `Free first mow booked. ${dollars(deal.price ?? 0)} ${f} if they like it.`;
  } else if (kind === 'cold') o.summary = 'They want to think about it. Try again in 5 days.';
  else if (kind === 'rejected') o.summary = 'Door closed. They were offended.';
  else o.summary = 'You walked away.';
  n.outcome = o;
}

function result(n: NegotiationState, lines: PitchLine[], counter: number | null, effect: StepResult['effect'], finalOffer: boolean): StepResult {
  return { lines, mood: n.mood, counter, patience: n.patience, done: n.done, outcome: n.outcome, effect, finalOffer };
}

function dollars(x: number): string { return '$' + Math.round(x).toLocaleString('en-US'); }

function listAddOns(addOns: AddOn[]): string {
  const names = addOns.map((x) => ADDON_LABEL[x].toLowerCase());
  if (names.length <= 1) return names[0] ?? '';
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function firstName(full: string): string { return (full || '').split(' ')[0] || 'there'; }

function say(n: NegotiationState, text: string, vars: Record<string, string | number> = {}): string {
  const c = n.ctx;
  return fill(text, {
    name: firstName(c.house.ownerName),
    company: c.companyName || 'the lawn company',
    street: c.house.street,
    rival: c.rival?.name ?? 'your current service',
    grass: `${c.grassIn.toFixed(1)} inches`,
    ...vars,
  });
}

/** Per-archetype lines, re-exported for the UI (door-open card, nobody-home toasts). */
export function lineSet(archetypeId: string): LineSet { return linesFor(archetypeId); }
export type { PointId };
export type { Rng };
