// Job Result: quality count-up, stars, breakdown, penalties, client reaction, pay, satisfaction change.
import { audio } from '../../audio';
import * as sim from '../../sim';
import { store } from '../../core/store';
import type { Tone } from '../../core/types';
import { money } from '../../core/format';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import { avatar, bar, satColor, satLabel, starsView, qColor, countUp, clamp } from '../kit';
import { finishResult } from '../flows';
import { prefs } from '../prefs';
import { ui } from '../uistate';

const MOOD: Record<string, { label: string; icon: string; color: string }> = {
  delighted: { label: 'Delighted', icon: 'heart', color: 'var(--ui-g-600)' },
  happy: { label: 'Happy', icon: 'smile', color: 'var(--ui-g-500)' },
  neutral: { label: 'Fine', icon: 'meh', color: 'var(--ui-sun-600)' },
  unhappy: { label: 'Unhappy', icon: 'frown', color: 'var(--ui-orange)' },
  angry: { label: 'Angry', icon: 'frown', color: 'var(--ui-red)' },
};

const TONE_LABEL: Record<Tone, string> = { friendly: 'Friendly', professional: 'Professional', direct: 'Direct', funny: 'Funny' };
const TONE_ICON: Record<Tone, string> = { friendly: 'smile', professional: 'handshake', direct: 'target', funny: 'sparkle' };

/** Small talk after the job: pick a tone, the client reacts, a tone they like earns a charm tip. */
function talkView(clientId: string, canTalk: boolean): Raw | string {
  const r = ui.result;
  if (!r) return '';
  const t = r.talk;
  if (t) {
    const cls = t.reaction === 'liked' ? 'ui-note--good' : t.reaction === 'disliked' ? 'ui-note--bad' : '';
    return html`<div class="ui-talk">
      <div class="ui-talk__line ui-talk__line--you">${t.playerLine}</div>
      <div class="ui-talk__line">${t.reply}</div>
      <div class="ui-note ${cls}" style="margin-top:8px">${raw(icon(t.reaction === 'liked' ? 'heart' : t.reaction === 'disliked' ? 'frown' : 'meh'))}${t.message}</div>
    </div>`;
  }
  if (!canTalk) return '';
  const c = sim.clientById(store.state, clientId);
  if (!c || !sim.canSmallTalk(store.state, clientId)) return '';
  const known = c.likedTone;
  return html`<div class="ui-talk">
    <div class="ui-label">Small talk${known ? html` <span class="ui-tiny ui-muted">· they liked ${TONE_LABEL[known].toLowerCase()} last time</span>` : ''}</div>
    <div class="ui-talk__tones">
      ${sim.TONES.map((tone) => html`<button class="ui-btn ui-btn--sm ${known === tone ? 'ui-btn--primary' : ''}" data-click="talk" data-tone="${tone}">${raw(icon(TONE_ICON[tone]))}${TONE_LABEL[tone]}</button>`)}
    </div>
  </div>`;
}

function verdict(q: number): string {
  if (q >= 95) return 'Flawless';
  if (q >= 88) return 'Excellent';
  if (q >= 78) return 'Great job';
  if (q >= 68) return 'Solid';
  if (q >= 55) return 'Rough';
  return 'Poor';
}

function render(): Raw {
  const r = ui.result;
  if (!r) return html`<div class="ui-empty">${raw(icon('mower'))}<h3>No job to show.</h3><div style="margin-top:14px"><button class="ui-btn ui-btn--go" data-click="hub">Today</button></div></div>`;
  const o = r.outcome;
  const b = o.breakdown;
  const mood = MOOD[o.mood] || MOOD.neutral;
  // small talk can nudge satisfaction after the job
  const sAfter = r.talk ? r.talk.satisfaction : o.satisfactionAfter;
  const dS = sAfter - o.satisfactionBefore;
  const q = Math.round(o.q);
  const events = (o.events || []).filter((e) => !/^tip\b/i.test(e));
  const reduced = prefs.reducedMotion || !!r.shown;
  return html`
  <div class="ui-result">
    ${r.levelAfter > r.levelBefore ? html`<div class="ui-levelup">${raw(icon('level'))}<b>Level ${r.levelAfter}</b><span>New skill point to spend.</span><button class="ui-btn ui-btn--sm ui-btn--primary" data-click="skills">Skills</button></div>` : ''}
    <div class="ui-result__grid">
      <section class="ui-card ui-result__score">
        <div class="ui-result__kicker">${r.kind === 'autopilot' ? 'Autopilot job' : 'Job complete'} · ${r.address}</div>
        <div class="ui-result__q" style="color:${qColor(q)}"><span class="ui-result__qnum" data-q="${q}">${reduced ? q : 0}</span><small>/100</small></div>
        <div class="ui-result__verdict">${verdict(q)}</div>
        <div class="ui-result__stars" data-stars="${b.stars.toFixed(3)}">${starsView(reduced ? b.stars : 0, { lg: true })}</div>
        ${b.capped ? html`<div class="ui-note" style="margin-top:12px">${raw(icon('info'))}Your mower's quality cap limited this score. Better gear raises it.</div>` : ''}
        <div class="ui-result__parts">
          ${b.parts.map((p, i) => html`<div class="ui-meter" style="--d:${(i * 0.12 + 0.3).toFixed(2)}s">
            <span class="ui-meter__label">${p.label}</span><span class="ui-meter__val">${p.value.toFixed(1)} / ${p.max}</span>
            ${bar(p.max > 0 ? p.value / p.max : 0, { color: p.max > 0 && p.value / p.max >= 0.85 ? 'var(--ui-g-500)' : p.max > 0 && p.value / p.max >= 0.6 ? 'var(--ui-sun-500)' : 'var(--ui-orange)' })}
          </div>`)}
        </div>
        ${b.penalties.length ? html`<div class="ui-result__pen">
          <div class="ui-label" style="margin-bottom:6px">Penalties</div>
          ${b.penalties.map((p) => html`<div class="ui-pen"><span>${raw(icon('alert'))}${p.label}</span><b>-${p.points.toFixed(1)}</b></div>`)}
        </div>` : ''}
      </section>

      <section class="ui-col" style="gap:16px">
        <div class="ui-card ui-result__client">
          <div class="ui-row" style="gap:14px">
            <span class="ui-result__av" style="--mood:${mood.color}">${avatar(r.portrait, r.ownerName, 84)}</span>
            <div class="ui-grow"><div class="ui-strong" style="font-size:19px;font-family:var(--ui-font-display)">${r.ownerName}</div>
              <span class="ui-chip" style="background:${mood.color};color:#fff">${raw(icon(mood.icon))}${mood.label}</span></div>
          </div>
          <blockquote class="ui-bubble">${o.reaction}</blockquote>
          ${talkView(o.clientId, !!o.canTalk)}
          ${o.trialResult ? html`<div class="ui-note ${o.trialResult === 'signed' ? 'ui-note--good' : 'ui-note--bad'}" style="margin-top:12px">${raw(icon(o.trialResult === 'signed' ? 'handshake' : 'x'))}${o.trialResult === 'signed' ? 'Trial passed. They signed on as a client.' : 'Trial failed. They passed on the contract.'}</div>` : ''}
          <div style="margin-top:16px">
            <div class="ui-row" style="justify-content:space-between"><span class="ui-label">Satisfaction</span>
              <span class="ui-strong ui-num">${Math.round(o.satisfactionBefore)} ${raw(icon('arrowR'))} <span style="color:${satColor(sAfter)}">${Math.round(sAfter)}</span>
              <span class="ui-chip ${dS >= 0 ? '' : 'ui-chip--red'}" style="margin-left:4px">${dS >= 0 ? '+' : ''}${dS.toFixed(0)}</span></span></div>
            <div class="ui-satdelta" style="margin-top:6px">
              ${bar(clamp(sAfter / 100, 0, 1), { color: satColor(sAfter), cls: 'ui-bar--thick', cmp: o.satisfactionBefore / 100 })}
            </div>
            <div class="ui-tiny ui-muted" style="margin-top:4px">${satLabel(sAfter)}</div>
          </div>
        </div>

        <div class="ui-card ui-card--green ui-result__money">
          <div class="ui-result__paid"><span class="ui-label">Paid</span><b class="ui-result__cash" data-v="${o.paid}">${money(reduced ? o.paid : 0)}</b></div>
          <div class="ui-result__minis">
            ${o.tip > 0 ? html`<div class="ui-mini ui-mini--tip">${raw(icon('heart'))}<span>Tip</span><b>+${money(o.tip)}</b></div>` : ''}
            ${r.talk && r.talk.tip > 0 ? html`<div class="ui-mini ui-mini--tip">${raw(icon('smile'))}<span>Charm tip</span><b>+${money(r.talk.tip)}</b></div>` : ''}
            <div class="ui-mini">${raw(icon('level'))}<span>XP</span><b>+${Math.round(o.xp)}</b></div>
            <div class="ui-mini">${raw(icon('clock'))}<span>Time</span><b>${Math.round(o.minutes)} min</b></div>
            ${o.fuelCost > 0 ? html`<div class="ui-mini ui-mini--cost">${raw(icon('fuel'))}<span>Fuel</span><b>-${money(o.fuelCost, true)}</b></div>` : ''}
            ${o.damageCost > 0 ? html`<div class="ui-mini ui-mini--cost">${raw(icon('alert'))}<span>Damage</span><b>-${money(o.damageCost)}</b></div>` : ''}
          </div>
          ${o.tipParts && o.tipParts.length ? html`<div class="ui-tipparts">${o.tipParts.map((p) => html`<span class="ui-chip">${p.label} +${money(p.amount, true)}</span>`)}</div>` : ''}
        </div>
        ${events.length ? html`<div class="ui-card ui-card--flat"><div class="ui-col" style="gap:6px">${events.map((e) => html`<div class="ui-small ui-strong">${raw(icon('info'))} ${e}</div>`)}</div></div>` : ''}
        <button class="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" data-click="continue">Continue<kbd class="ui-kbd ui-hide-sm">Enter</kbd></button>
      </section>
    </div>
  </div>`;
}

export const resultScreen: Screen = {
  id: 'result',
  render,
  after(root, first) {
    const r = ui.result;
    if (!r || !first || r.shown) return;
    r.shown = true;
    const reduced = prefs.reducedMotion;
    const qEl = root.querySelector<HTMLElement>('.ui-result__qnum');
    if (qEl) countUp(qEl, 0, Number(qEl.dataset.q) || 0, (n) => String(Math.round(n)), 1200, reduced);
    const stars = root.querySelector<HTMLElement>('.ui-result__stars');
    if (stars && !reduced) {
      const target = Number(stars.dataset.stars) || 0;
      setTimeout(() => {
        stars.querySelectorAll<HTMLElement>('.ui-star').forEach((st, i) => {
          setTimeout(() => {
            st.style.setProperty('--f', String(clamp(target - i, 0, 1)));
            if (target - i > 0.2) try { audio.play('tip', { volume: 0.35, rate: 1 + i * 0.08 }); } catch { /* ignore */ }
          }, i * 170);
        });
      }, 700);
    }
    const cash = root.querySelector<HTMLElement>('.ui-result__cash');
    if (cash) setTimeout(() => countUp(cash, 0, Number(cash.dataset.v) || 0, (n) => money(Math.round(n)), 900, reduced), reduced ? 0 : 1100);
    try {
      audio.play(r.outcome.paid > 0 ? 'cash' : 'click');
      if (r.outcome.tip > 0) setTimeout(() => audio.play('tip'), 1400);
      if (r.levelAfter > r.levelBefore) setTimeout(() => audio.play('level_up'), 1800);
      if (r.outcome.trialResult === 'signed') setTimeout(() => audio.play('deal'), 900);
    } catch { /* ignore */ }
  },
  handlers: {
    continue: () => finishResult(),
    talk: (el: HTMLElement) => {
      const r = ui.result;
      if (!r || r.talk || !store.loaded) return;
      const res = sim.smallTalk(store.state, r.outcome.clientId, (el.dataset.tone || 'friendly') as Tone);
      if (!res.ok) return;
      r.talk = res;
      try { audio.play(res.tip > 0 ? 'tip' : 'click', { volume: 0.6 }); } catch { /* ignore */ }
      store.commit({ saveNow: true });
    },
    hub: () => navigate('hub'),
    skills: () => { ui.result = null; navigate('skills'); },
  },
  onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { finishResult(); return true; }
    return false;
  },
  music: 'music_hub',
};

