// Post-job small talk (docs/DESIGN.md section 10, charm tips). After a job the owner may chat with the
// client once per visit. The client's archetype tone affinity decides how it lands: a tone they like
// earns a charm tip and rapport, a tone they dislike costs a little of both.
import type { GameState, Id, SmallTalkResult, Tone } from '../core/types';
import { clamp } from '../core/rng';
import { ARCHETYPE_BY_ID } from '../data/archetypes';
import { fill } from '../data/dialogue';
import { pickFresh } from '../data/pick';
import { PLAYER_SMALLTALK, SMALLTALK, SMALLTALK_GENERIC } from '../data/smalltalk';
import { RAPPORT_START } from './constants';
import { addLedger, firstName, hasPerk, logDay, r1, r2, withRng } from './util';
import { houseInfo } from './world';
import { checkGoals } from './goals';

export const TONES: Tone[] = ['friendly', 'professional', 'direct', 'funny'];

/** Can the owner chat with this client right now (serviced today, not chatted yet)? */
export function canSmallTalk(state: GameState, clientId: Id): boolean {
  const c = state.clients.find((x) => x.id === clientId);
  return !!c && !c.commercial && c.lastServiceDay === state.day && c.talkDay !== state.day;
}

export function smallTalk(state: GameState, clientId: Id, tone: Tone): SmallTalkResult {
  const fail = (message: string): SmallTalkResult => ({ ok: false, message, playerLine: '', reply: '', reaction: 'neutral', tip: 0, rapport: 0, satisfaction: 0 });
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return fail('Unknown client.');
  if (!TONES.includes(tone)) return fail('Pick a tone.');
  if (c.commercial) return fail('Site contacts do not tip.');
  if (c.lastServiceDay !== state.day) return fail('Nothing to chat about today.');
  if (c.talkDay === state.day) return fail('You already chatted today.');
  const info = houseInfo(state, c.houseId);
  const arch = ARCHETYPE_BY_ID[info.archetypeId];
  const charmer = hasPerk(state, 'charmer');
  let aff = arch?.tone[tone] ?? 0;
  if (charmer && aff < 0) aff = 0;
  // Nobody warms up much right after a disappointing job: charm lands softer and earns no tip.
  const upset = c.lastQ >= 0 && c.lastQ < c.expectation - 8;
  if (upset && aff > 0) aff = 0;
  const reaction: SmallTalkResult['reaction'] = aff > 0 ? 'liked' : aff < 0 ? 'disliked' : 'neutral';
  const own = SMALLTALK[info.archetypeId] ?? {};
  const pool = [...(own[reaction] ?? []), ...(own[reaction] ?? []), ...SMALLTALK_GENERIC[reaction]];
  const vars = { name: firstName(info.ownerName), company: state.company.name };
  return withRng(state, (rng) => {
    const playerLine = fill(pickFresh(rng, PLAYER_SMALLTALK[tone] ?? PLAYER_SMALLTALK.friendly), vars);
    const reply = fill(pickFresh(rng, pool.length ? pool : SMALLTALK_GENERIC.neutral), vars);
    const gain = charmer ? 2 : 1;
    let rapport = c.rapport ?? RAPPORT_START;
    rapport += reaction === 'liked' ? 0.1 * gain : reaction === 'neutral' ? 0.03 * gain : -0.06;
    c.rapport = r2(clamp(rapport, 0, 1));
    const tipHabit = 0.5 + 0.5 * (arch?.tipMult ?? 1);
    const pleased = c.lastQ >= c.expectation - 10 ? 1 : 0.4;
    let tip = 0;
    if (upset) tip = 0;
    else if (reaction === 'liked') tip = c.price * (0.04 + 0.12 * c.rapport) * tipHabit * pleased * (charmer ? 1.5 : 1);
    else if (reaction === 'neutral' && rng.chance(0.35)) tip = c.price * 0.035 * tipHabit * pleased * (charmer ? 1.5 : 1);
    tip = r2(tip);
    if (tip < 1) tip = 0;
    const ds = reaction === 'liked' ? 2 : reaction === 'disliked' ? -2 : 0;
    c.satisfaction = r1(clamp(c.satisfaction + ds, 0, 100));
    c.talkDay = state.day;
    if (reaction === 'liked') {
      c.likedTone = tone;
      state.flags.likedTalks = (Number(state.flags.likedTalks) || 0) + 1;
    }
    if (tip > 0) {
      addLedger(state, tip, 'tip', `Tip, ${info.address}`);
      c.tips = r2(c.tips + tip);
      c.totalPaid = r2(c.totalPaid + tip);
      state.stats.revenue = r2(state.stats.revenue + tip);
      state.flags.tips = (Number(state.flags.tips) || 0) + 1;
      logDay(state, (l) => {
        const j = [...l.jobs].reverse().find((x) => x.clientId === c.id);
        if (j) j.paid = r2(j.paid + tip);
      });
    }
    checkGoals(state);
    const sat = ds > 0 ? ` Satisfaction +${ds}.` : ds < 0 ? ` Satisfaction ${ds}.` : '';
    const message = upset && reaction !== 'disliked' ? 'Polite, but they are still unhappy with the lawn.'
      : reaction === 'liked' ? (tip > 0 ? `Charm tip: $${tip.toFixed(2)}.${sat}` : `They liked that.${sat}`)
      : reaction === 'disliked' ? `That fell flat.${sat}` : tip > 0 ? `Tip: $${tip.toFixed(2)}.` : 'Polite enough.';
    return { ok: true, message, playerLine, reply, reaction, tip, rapport: c.rapport, satisfaction: c.satisfaction };
  });
}
