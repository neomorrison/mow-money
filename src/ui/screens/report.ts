// Day Report: shown after End Day (or a winter skip).
import * as sim from '../../sim';
import { store } from '../../core/store';
import { audio } from '../../audio';
import { money } from '../../core/format';
import type { DayReport } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon, weatherIcon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import { safe, calSafe, starsView, qColor, WEATHER_LABEL, WEATHER_NOTE, SEASON_LABEL, countUp, plural } from '../kit';
import { prefs } from '../prefs';
import { ui } from '../uistate';
import { CAT_INFO } from './finance';

const SEASON_LINE: Record<string, string> = {
  spring: 'Grass is growing fast. Weekly clients keep lawns in shape.',
  summer: 'Heat slows growth. Watch for drought.',
  fall: 'Leaves on every lawn. Cleanup counts toward quality.',
  winter: 'No growth, no mowing. Contracts pause until spring.',
};

function list<T>(title: string, ic: string, items: T[], row: (t: T) => Raw, empty?: string): Raw {
  if (!items.length && !empty) return html``;
  return html`<section class="ui-card ui-card--flat">
    <div class="ui-card__head"><span class="ui-card__title">${raw(icon(ic))}${title}</span>${items.length ? html`<span class="ui-count ui-chip ui-chip--grey">${items.length}</span>` : ''}</div>
    ${items.length ? html`<div class="ui-rep-list">${items.map(row)}</div>` : html`<p class="ui-small ui-muted">${empty}</p>`}
  </section>`;
}

function render(): Raw {
  const r: DayReport | null = ui.report;
  if (!r) return html`<div class="ui-empty">${raw(icon('calendar'))}<h3>No report to show.</h3><div style="margin-top:14px"><button class="ui-btn ui-btn--go" data-click="next">Today</button></div></div>`;
  const anim = !prefs.reducedMotion && !ui.reportShown;
  const dRep = r.repAfter - r.repBefore;
  const ach = safe(() => sim.ACHIEVEMENTS, []);
  const tomorrow = calSafe(r.day + 1);
  return html`
  <div class="ui-report">
    <div class="ui-page-head">
      <div class="ui-page-head__text"><h1>Day report</h1><p>${r.label}</p></div>
      <button class="ui-btn ui-btn--primary ui-btn--lg" data-click="next">${raw(icon('sunrise'))}Next day<kbd class="ui-kbd ui-hide-sm">Enter</kbd></button>
    </div>

    ${r.seasonChanged ? html`<div class="ui-season ui-season--${r.seasonChanged}">
      <span class="ui-season__ic">${raw(r.seasonChanged === 'winter' ? weatherIcon('winter') : r.seasonChanged === 'fall' ? icon('leaf') : r.seasonChanged === 'summer' ? weatherIcon('sunny') : icon('grass'))}</span>
      <div><div class="ui-season__k">New season</div><div class="ui-season__t">${SEASON_LABEL[r.seasonChanged]} is here</div><div class="ui-season__s">${SEASON_LINE[r.seasonChanged]}</div></div>
    </div>` : ''}

    ${r.achievements.length ? html`<div class="ui-ach-banner">${r.achievements.map((id) => {
      const a = ach.find((x) => x.id === id);
      return html`<div class="ui-ach is-on is-new"><span class="ui-ach__ic">${raw(icon('trophy'))}</span><div><div class="ui-tiny ui-strong" style="color:var(--ui-sun-700);text-transform:uppercase;letter-spacing:.06em">Achievement</div><b>${a?.name || id}</b><div class="ui-tiny ui-muted">${a?.blurb || ''}</div></div></div>`;
    })}</div>` : ''}

    <div class="ui-grid ui-grid--4 ui-rep-stats">
      <div class="ui-stat ui-stat--good"><div class="ui-stat__label">${raw(icon('arrowUp'))}Revenue</div><div class="ui-stat__value" data-count="${r.revenue}">${money(anim ? 0 : r.revenue)}</div></div>
      <div class="ui-stat ui-stat--bad"><div class="ui-stat__label">${raw(icon('arrowDown'))}Expenses</div><div class="ui-stat__value" data-count="${-Math.abs(r.expenses)}">${money(anim ? 0 : -Math.abs(r.expenses))}</div></div>
      <div class="ui-stat ${r.net >= 0 ? 'ui-stat--good' : 'ui-stat--bad'}"><div class="ui-stat__label">${raw(icon('cash'))}Net</div><div class="ui-stat__value" data-count="${r.net}" data-sign="1">${r.net > 0 && !anim ? '+' : ''}${money(anim ? 0 : r.net)}</div></div>
      <div class="ui-stat"><div class="ui-stat__label">${raw(icon('bank'))}Cash</div><div class="ui-stat__value">${money(r.cashEnd)}</div></div>
    </div>

    <div class="ui-rep-grid">
      <div class="ui-col" style="gap:16px">
        ${list('Jobs done', 'mower', r.jobs, (j) => html`<div class="ui-rep-row"><span class="ui-rep-q" style="background:${qColor(j.q)}">${Math.round(j.q)}</span><div class="ui-grow"><b>${j.address}</b><div class="ui-tiny ui-muted">${j.by}</div></div><b class="ui-good ui-num">${j.paid > 0 ? `+${money(j.paid)}` : 'Trial'}</b></div>`, 'No lawns mowed today.')}
        ${list('Missed', 'alert', r.missed, (m) => html`<div class="ui-rep-row"><span class="ui-kit-ic ui-bad">${raw(icon('clock'))}</span><div class="ui-grow"><b>${m.address}</b><div class="ui-tiny ui-bad ui-strong">${m.reason}</div></div></div>`)}
        ${list('New clients', 'handshake', r.newClients, (c) => html`<div class="ui-rep-row"><span class="ui-kit-ic ui-good">${raw(icon('plus'))}</span><div class="ui-grow"><b>${c.address}</b><div class="ui-tiny ui-muted">Signed by ${c.by}</div></div><b class="ui-num">${money(c.price)}</b></div>`)}
        ${list('Lost clients', 'frown', r.lostClients, (c) => html`<div class="ui-rep-row"><span class="ui-kit-ic ui-bad">${raw(icon('minus'))}</span><div class="ui-grow"><b>${c.address}</b><div class="ui-tiny ui-bad ui-strong">${c.reason}</div></div></div>`)}
        ${list('Referrals', 'heart', r.referrals, (c) => html`<div class="ui-rep-row"><span class="ui-kit-ic ui-good">${raw(icon('door'))}</span><div class="ui-grow"><b>${c.address}</b><div class="ui-tiny ui-muted">Warm lead from ${c.from}</div></div></div>`)}
        ${list('Staff', 'crew', r.staff, (e) => html`<div class="ui-rep-row"><span class="ui-kit-ic">${raw(icon('user'))}</span><div class="ui-grow"><b>${e.name}</b><div class="ui-tiny ui-muted">${e.event}</div></div></div>`)}
        ${list('News', 'info', r.events, (e) => html`<div class="ui-rep-row"><span class="ui-kit-ic">${raw(icon('sparkle'))}</span><div class="ui-grow ui-strong ui-small">${e}</div></div>`)}
      </div>
      <div class="ui-col" style="gap:16px">
        <section class="ui-card ui-card--sun">
          <div class="ui-card__title">${raw(icon('star'))}Reputation</div>
          <div class="ui-row" style="margin-top:10px;gap:12px">
            <span class="ui-stat__value" style="margin:0">${r.repAfter.toFixed(2)}</span>
            <span class="ui-chip ${dRep > 0.004 ? '' : dRep < -0.004 ? 'ui-chip--red' : 'ui-chip--grey'}">${dRep > 0.004 ? raw(icon('arrowUp')) : dRep < -0.004 ? raw(icon('arrowDown')) : ''}${dRep >= 0 ? '+' : ''}${dRep.toFixed(2)}</span>
          </div>
          <div style="margin-top:6px">${starsView(r.repAfter, { lg: true })}</div>
        </section>
        <section class="ui-card ui-card--sky">
          <div class="ui-card__title">${raw(icon('calendar'))}Tomorrow</div>
          <div class="ui-row" style="margin-top:10px;gap:12px">
            <span class="ui-wxbox" style="width:56px;height:56px">${raw(weatherIcon(r.weatherTomorrow))}</span>
            <div><div class="ui-strong" style="font-size:18px">${tomorrow.weekdayName}: ${WEATHER_LABEL[r.weatherTomorrow]}</div><div class="ui-small ui-muted">${WEATHER_NOTE[r.weatherTomorrow]}</div></div>
          </div>
        </section>
        ${r.lines.length ? html`<section class="ui-card ui-card--flat">
          <div class="ui-card__title">${raw(icon('book'))}Ledger</div>
          <div class="ui-ledger" style="margin-top:10px">${r.lines.map((l) => {
            const info = CAT_INFO[l.cat] || { label: l.cat, icon: 'cash' };
            return html`<div class="ui-ledger__row"><span class="ui-ledger__ic ${l.amount >= 0 ? 'is-in' : 'is-out'}">${raw(icon(info.icon))}</span><span class="ui-grow ui-small"><b>${l.note || info.label}</b></span><span class="ui-num ui-strong ${l.amount >= 0 ? 'ui-good' : 'ui-bad'}">${l.amount > 0 ? '+' : ''}${money(l.amount, true)}</span></div>`;
          })}</div>
        </section>` : ''}
        <p class="ui-tiny ui-muted" style="text-align:center">${plural(store.loaded ? store.state.clients.filter((c) => c.status === 'active').length : 0, 'active client')}</p>
      </div>
    </div>
  </div>`;
}

export const reportScreen: Screen = {
  id: 'report',
  render,
  after(root, first) {
    if (!first || ui.reportShown || !ui.report) return;
    ui.reportShown = true;
    const reduced = prefs.reducedMotion;
    root.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
      const v = Number(el.dataset.count) || 0;
      const sign = el.dataset.sign === '1';
      setTimeout(() => countUp(el, 0, v, (n) => `${sign && n > 0 ? '+' : ''}${money(Math.round(n))}`, 900, reduced), reduced ? 0 : 200 + i * 180);
    });
    try {
      if (ui.report.achievements.length) setTimeout(() => audio.play('achievement'), 500);
      else if (ui.report.net > 0) setTimeout(() => audio.play('cash', { volume: 0.7 }), 400);
    } catch { /* ignore */ }
  },
  handlers: {
    next: () => { ui.report = null; navigate('hub'); },
  },
  onKey(e) {
    if (e.key === 'Enter') { ui.report = null; navigate('hub'); return true; }
    return false;
  },
};
