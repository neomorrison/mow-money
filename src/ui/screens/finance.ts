// Finance: P&L, ledger, loans, insurance, marketing and commercial bids.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money, sqft } from '../../core/format';
import type { Bid, GameState, LedgerCategory, LoanOffer } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { safe, act, calSafe, bar, emptyState, plural, hoodName, townName } from '../kit';
import { confirmDialog } from '../overlay';
import { ui } from '../uistate';
import { rerender } from '../app';

export const CAT_INFO: Record<LedgerCategory, { label: string; icon: string }> = {
  job: { label: 'Mowing', icon: 'mower' },
  tip: { label: 'Tips', icon: 'heart' },
  sale: { label: 'Sales', icon: 'sell' },
  loan: { label: 'Loans in', icon: 'bank' },
  other_in: { label: 'Other income', icon: 'plus' },
  fuel: { label: 'Fuel', icon: 'fuel' },
  wages: { label: 'Wages', icon: 'crew' },
  equipment: { label: 'Equipment', icon: 'mower' },
  repair: { label: 'Repairs', icon: 'wrench' },
  damage: { label: 'Damages', icon: 'alert' },
  marketing: { label: 'Marketing', icon: 'megaphone' },
  insurance: { label: 'Insurance', icon: 'shield' },
  loan_payment: { label: 'Loan payments', icon: 'bank' },
  tax: { label: 'Taxes', icon: 'percent' },
  branch: { label: 'Branches', icon: 'pin' },
  other_out: { label: 'Other costs', icon: 'minus' },
};

const MKT = [
  { kind: 'flyers' as const, label: 'Flyers', cost: 80, icon: 'book', blurb: '100 flyers on doorsteps.' },
  { kind: 'hangers' as const, label: 'Door hangers', cost: 150, icon: 'door', blurb: 'Hangers on every knob.' },
];

function weeklyPayment(L: number, apr: number, n: number): number {
  const i = apr / 52;
  if (i <= 0) return L / n;
  return (L * i) / (1 - Math.pow(1 + i, -n));
}

function pnl(label: string, days: number, s: GameState): Raw {
  const f = safe(() => sim.financeSummary(s, days), null, 'financeSummary');
  if (!f) return html`<div class="ui-card ui-card--flat"><div class="ui-card__title">${label}</div><p class="ui-muted" style="margin-top:8px">No numbers yet.</p></div>`;
  const cats = Object.entries(f.byCategory || {}).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map(([, v]) => Math.abs(v)));
  return html`<div class="ui-card ui-card--flat">
    <div class="ui-card__head"><span class="ui-card__title">${raw(icon('calendar'))}${label}</span></div>
    <div class="ui-pnl">
      <div><span class="ui-label">Revenue</span><b class="ui-good">${money(f.revenue)}</b></div>
      <div><span class="ui-label">Expenses</span><b class="ui-bad">${money(-Math.abs(f.expenses))}</b></div>
      <div><span class="ui-label">Net</span><b class="${f.net >= 0 ? 'ui-good' : 'ui-bad'}">${f.net > 0 ? '+' : ''}${money(f.net)}</b></div>
    </div>
    ${cats.length ? html`<div class="ui-col" style="gap:8px;margin-top:14px">${cats.map(([k, v]) => {
      const info = CAT_INFO[k as LedgerCategory] || { label: k, icon: 'cash' };
      return html`<div class="ui-cat-row"><span class="ui-cat-row__l">${raw(icon(info.icon))}${info.label}</span>${bar(Math.abs(v) / max, { cls: 'ui-bar--thin', color: v >= 0 ? 'var(--ui-g-500)' : 'var(--ui-red)' })}<span class="ui-cat-row__v ${v >= 0 ? 'ui-good' : 'ui-bad'}">${money(v)}</span></div>`;
    })}</div>` : html`<p class="ui-small ui-muted" style="margin-top:10px">Nothing booked in this period.</p>`}
  </div>`;
}

function overview(s: GameState): Raw {
  const staffN = s.staff.length;
  const insCost = 30 + 10 * staffN;
  return html`
  <div class="ui-grid ui-grid--2">${pnl('Last 7 days', 7, s)}${pnl('Last 28 days', 28, s)}</div>
  <div class="ui-grid ui-grid--2" style="margin-top:16px">
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('shield'))}Insurance</span>
        <label class="ui-toggle"><input type="checkbox" ${s.insured ? raw('checked') : ''} data-change="insure"><span class="ui-toggle__track"></span><span class="ui-sr">Insurance</span></label>
      </div>
      <p class="ui-small ui-muted">${money(insCost)} per week (${money(30)} plus ${money(10)} per employee). Covers damage claims above a ${money(100)} deductible. Required to hire staff and bid on commercial work.</p>
      <div style="margin-top:10px">${s.insured ? html`<span class="ui-chip">${raw(icon('check'))}Covered</span>` : html`<span class="ui-chip ui-chip--orange">${raw(icon('alert'))}Not covered</span>`}</div>
    </div>
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('fuel'))}Fuel</span></div>
      <div class="ui-stat__value">$${(s.weather?.fuelPrice || 3.6).toFixed(2)}<span class="ui-small ui-muted"> per gallon</span></div>
      <p class="ui-small ui-muted" style="margin-top:6px">Moves a little each week. Taxes: 15 percent of profit at each season end.</p>
    </div>
  </div>`;
}

function ledger(s: GameState): Raw {
  const entries = [...(s.ledger || [])].reverse();
  if (!entries.length) return emptyState('book', 'No entries yet', 'Payments and costs show up here as they happen.');
  const byDay = new Map<number, typeof entries>();
  for (const e of entries) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day)!.push(e);
  }
  return html`<div class="ui-col" style="gap:16px">${[...byDay.entries()].slice(0, 30).map(([day, list]) => {
    const net = list.reduce((a, e) => a + e.amount, 0);
    return html`<div class="ui-card ui-card--flat" style="padding:14px 16px">
      <div class="ui-row" style="justify-content:space-between;margin-bottom:8px"><b>${calSafe(day).label}</b><b class="${net >= 0 ? 'ui-good' : 'ui-bad'} ui-num">${net > 0 ? '+' : ''}${money(net)}</b></div>
      <div class="ui-ledger">${list.map((e) => {
        const info = CAT_INFO[e.cat] || { label: e.cat, icon: 'cash' };
        return html`<div class="ui-ledger__row"><span class="ui-ledger__ic ${e.amount >= 0 ? 'is-in' : 'is-out'}">${raw(icon(info.icon))}</span><span class="ui-grow"><span class="ui-strong">${e.note || info.label}</span><span class="ui-tiny ui-muted"> · ${info.label}</span></span><span class="ui-num ui-strong ${e.amount >= 0 ? 'ui-good' : 'ui-bad'}">${e.amount > 0 ? '+' : ''}${money(e.amount, true)}</span></div>`;
      })}</div>
    </div>`;
  })}</div>`;
}

function loans(s: GameState): Raw {
  const offer: LoanOffer = safe(() => sim.loanOffer(s), { limit: 0, apr: 0.09, terms: [13, 26, 52] }, 'loanOffer');
  const limit = Math.max(0, Math.floor(offer.limit / 100) * 100);
  if (!offer.terms.includes(ui.loanWeeks)) ui.loanWeeks = offer.terms[Math.min(1, offer.terms.length - 1)] || 26;
  if (ui.loanAmount <= 0 || ui.loanAmount > limit) ui.loanAmount = Math.min(limit, Math.max(100, Math.round(limit / 2 / 100) * 100));
  const L = ui.loanAmount;
  const pay = weeklyPayment(L, offer.apr, ui.loanWeeks);
  const interest = pay * ui.loanWeeks - L;
  const debt = s.loans.reduce((a, l) => a + l.balance, 0);
  return html`
  <div class="ui-grid ui-grid--2">
    <div class="ui-card">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('bank'))}New loan</span><span class="ui-chip ui-chip--sky">${(offer.apr * 100).toFixed(1)}% APR</span></div>
      ${limit >= 100 ? html`
        <div class="ui-row" style="justify-content:space-between"><span class="ui-label">Amount</span><b class="ui-loan-amt ui-num">${money(L)}</b></div>
        <input type="range" class="ui-range" min="100" max="${limit}" step="100" value="${L}" style="--p:${limit > 100 ? ((L - 100) / (limit - 100)) * 100 : 100}" data-input="loanAmt" aria-label="Loan amount">
        <div class="ui-row ui-tiny ui-faint" style="justify-content:space-between"><span>$100</span><span>Limit ${money(limit)}</span></div>
        <div class="ui-label" style="margin-top:14px">Term</div>
        <div class="ui-seg" style="margin-top:6px">${offer.terms.map((t) => html`<button class="${ui.loanWeeks === t ? 'is-on' : ''}" data-click="loanWeeks" data-w="${t}">${t} weeks</button>`)}</div>
        <dl class="ui-kv" style="margin-top:16px">
          <dt>Weekly payment</dt><dd class="ui-loan-pay">${money(pay, true)}</dd>
          <dt>Total interest</dt><dd class="ui-loan-int">${money(interest, true)}</dd>
        </dl>
        <button class="ui-btn ui-btn--primary ui-btn--block" style="margin-top:16px" data-click="takeLoan">${raw(icon('cash'))}Borrow <span class="ui-loan-btn">${money(L)}</span></button>
      ` : html`<p class="ui-muted">No credit available right now. Lenders look at equipment value, recent weekly revenue and current debt.</p>`}
    </div>
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('book'))}Your loans</span>${debt ? html`<span class="ui-chip ui-chip--red">${money(debt)} owed</span>` : ''}</div>
      ${s.loans.length ? html`<div class="ui-col" style="gap:12px">${s.loans.map((l) => html`<div class="ui-loan">
        <div class="ui-row" style="justify-content:space-between"><b>${money(l.balance)} left</b><span class="ui-small ui-muted">${money(l.weeklyPayment, true)}/week · ${plural(l.weeksLeft, 'week')}</span></div>
        ${bar(1 - l.balance / Math.max(1, l.principal), { cls: 'ui-bar--thin', color: 'var(--ui-sky-500)' })}
        <div class="ui-row" style="justify-content:space-between;margin-top:8px"><span class="ui-tiny ui-muted">Borrowed ${money(l.principal)} at ${(l.apr * 100).toFixed(1)}%</span>
        <button class="ui-btn ui-btn--sm" data-click="repay" data-id="${l.id}" data-b="${l.balance}" ${s.cash < 1 ? raw('disabled') : ''}>Repay ${money(Math.min(l.balance, Math.max(0, s.cash)))}</button></div>
      </div>`)}</div>` : html`<p class="ui-muted ui-small">No loans. Borrowing early can pay for a better mower that earns it back.</p>`}
    </div>
  </div>`;
}

function marketing(s: GameState): Raw {
  const hoods = safe(() => sim.hoods(s).filter((h) => h.unlocked && !h.spec.bidOnly), []);
  const active = (s.marketing || []).filter((m) => m.endDay >= s.day);
  const spendFor = (key: string) => active.filter((m) => m.hoodId && `${m.townId}.${m.hoodId}` === key).reduce((a, m) => a + m.spend, 0)
    + active.filter((m) => !m.hoodId && key.startsWith(m.townId + '.')).reduce((a, m) => a + m.spend * 0.5, 0);
  const towns = [...new Set(hoods.map((h) => h.townId))];
  return html`
  <p class="ui-muted ui-strong" style="margin-bottom:14px">Marketing brings extra leads for 14 days. Each extra dollar in the same place does a little less.</p>
  <div class="ui-grid ui-grid--auto">
    ${hoods.map((h) => {
      const spend = spendFor(h.key);
      const boost = 0.6 * Math.log(1 + spend / 200);
      return html`<div class="ui-card ui-card--flat">
        <div class="ui-card__head"><span class="ui-card__title">${raw(icon('pin'))}${h.spec.name}</span>${spend ? html`<span class="ui-chip ui-chip--sun">+${Math.round(boost * 100)}% leads</span>` : ''}</div>
        <div class="ui-col" style="gap:8px">${MKT.map((m) => html`<div class="ui-row"><span class="ui-kit-ic">${raw(icon(m.icon))}</span><div class="ui-grow"><b>${m.label}</b><div class="ui-tiny ui-muted">${m.blurb}</div></div><button class="ui-btn ui-btn--sm" data-click="mkt" data-kind="${m.kind}" data-key="${h.key}" ${s.cash < m.cost ? raw('disabled') : ''}>${money(m.cost)}</button></div>`)}</div>
      </div>`;
    })}
    ${towns.map((t) => html`<div class="ui-card ui-card--flat ui-card--sun">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('megaphone'))}${townName(t)} newspaper</span></div>
      <p class="ui-small ui-muted">A half-page ad reaches every neighborhood in town at half strength.</p>
      <div class="ui-row" style="margin-top:10px"><span class="ui-grow"></span><button class="ui-btn ui-btn--primary ui-btn--sm" data-click="mkt" data-kind="newspaper" data-key="${t}" ${s.cash < 400 ? raw('disabled') : ''}>${money(400)}</button></div>
    </div>`)}
  </div>
  <h2 class="ui-section-title">${raw(icon('calendar'))}Running campaigns<span class="ui-count">${active.length}</span></h2>
  ${active.length ? html`<div class="ui-col" style="gap:8px">${active.map((m) => html`<div class="ui-lost__row"><span class="ui-kit-ic">${raw(icon(m.kind === 'newspaper' ? 'megaphone' : m.kind === 'hangers' ? 'door' : 'book'))}</span><div class="ui-grow"><b>${m.kind === 'newspaper' ? 'Newspaper ad' : m.kind === 'hangers' ? 'Door hangers' : 'Flyers'}</b><div class="ui-tiny ui-muted">${m.hoodId ? hoodName(`${m.townId}.${m.hoodId}`) : townName(m.townId)} · ${money(m.spend)}</div></div><span class="ui-chip ui-chip--grey">${plural(Math.max(0, m.endDay - s.day + 1), 'day')} left</span></div>`)}</div>` : html`<p class="ui-muted ui-small">No campaigns running.</p>`}
  `;
}

function bidCard(b: Bid, s: GameState): Raw {
  const draft = ui.bidDrafts[b.id] ?? String(b.myBid ? Math.round(b.myBid) : Math.round(b.fairPrice));
  const closes = b.closesDay - s.day;
  return html`<article class="ui-card ui-bid">
    <div class="ui-card__head" style="align-items:flex-start">
      <span class="ui-kit-ic" style="width:46px;height:46px">${raw(icon('briefcase'))}</span>
      <div class="ui-grow"><h3 style="font-size:19px">${b.title}</h3><div class="ui-small ui-muted ui-strong">${hoodName(`${b.townId}.${b.hoodId}`)}</div></div>
      <span class="ui-chip ${closes <= 0 ? 'ui-chip--red' : 'ui-chip--orange'}">${closes <= 0 ? 'Closes today' : `Closes in ${plural(closes, 'day')}`}</span>
    </div>
    <div class="ui-row ui-row--wrap" style="gap:6px">
      <span class="ui-chip ui-chip--grey">${raw(icon('grass'))}${sqft(b.lawnM2)}</span>
      <span class="ui-chip ui-chip--grey">${raw(icon('calendar'))}${b.weeks} weeks, weekly</span>
      <span class="ui-chip ui-chip--sky" data-tip="Rivals bid near this">${raw(icon('target'))}Fair ~${money(b.fairPrice)}</span>
    </div>
    <div class="ui-row" style="margin-top:14px">
      <div class="ui-money-input ui-grow"><input class="ui-input" type="number" min="1" step="1" inputmode="numeric" value="${draft}" data-input="bidDraft" data-id="${b.id}" aria-label="Bid per mow"></div>
      <button class="ui-btn ui-btn--primary" data-click="bid" data-id="${b.id}">${raw(icon('gavel'))}${b.myBid ? 'Update bid' : 'Place bid'}</button>
    </div>
    <p class="ui-tiny ui-muted" style="margin-top:6px">${b.myBid ? `Your bid: ${money(b.myBid)} per mow. ` : ''}Lowest bid wins, adjusted for reputation. Contract ends after three services under 70 quality in a row.</p>
  </article>`;
}

function bids(s: GameState): Raw {
  const open = safe(() => sim.openBids(s), (s.bids || []).filter((b) => b.status === 'open'), 'openBids');
  const past = (s.bids || []).filter((b) => b.status !== 'open').slice(-12).reverse();
  return html`
  ${open.length ? html`<div class="ui-grid ui-grid--auto" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${open.map((b) => bidCard(b, s))}</div>`
    : emptyState('gavel', 'No open requests', 'Commercial properties, parks and the golf club post requests once they are open to you.')}
  ${past.length ? html`
    <h2 class="ui-section-title">${raw(icon('trophy'))}Results</h2>
    <div class="ui-col" style="gap:8px">${past.map((b) => html`<div class="ui-lost__row">
      <span class="ui-kit-ic">${raw(icon(b.status === 'won' ? 'trophy' : b.status === 'lost' ? 'x' : 'clock'))}</span>
      <div class="ui-grow"><b>${b.title}</b><div class="ui-tiny ui-muted">${b.myBid ? `You bid ${money(b.myBid)}` : 'No bid'}${b.winningBid ? ` · winning bid ${money(b.winningBid)}` : ''}${b.winner && b.status === 'lost' ? ` by ${b.winner}` : ''}</div></div>
      <span class="ui-chip ${b.status === 'won' ? '' : b.status === 'lost' ? 'ui-chip--red' : 'ui-chip--grey'}">${b.status === 'won' ? 'Won' : b.status === 'lost' ? 'Lost' : 'Expired'}</span>
    </div>`)}</div>` : ''}`;
}

function render(): Raw {
  const s = store.state;
  const tab = ui.financeTab;
  const openBids = safe(() => sim.openBids(s), []).length;
  const tabs: [typeof ui.financeTab, string, string][] = [
    ['overview', 'Overview', 'chart'], ['ledger', 'Ledger', 'book'], ['loans', 'Loans', 'bank'], ['marketing', 'Marketing', 'megaphone'], ['bids', 'Bids', 'gavel'],
  ];
  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Finance</h1><p>Cash on hand ${money(s.cash)}.</p></div>
  </div>
  <div class="ui-tabs-bar" role="tablist">${tabs.map(([id, label, ic]) => html`<button class="ui-tab ${tab === id ? 'is-on' : ''}" data-click="tab" data-id="${id}" role="tab">${raw(icon(ic))}${label}${id === 'bids' && openBids ? html`<span class="ui-count">${openBids}</span>` : ''}${id === 'loans' && s.loans.length ? html`<span class="ui-count">${s.loans.length}</span>` : ''}</button>`)}</div>
  ${tab === 'overview' ? overview(s) : tab === 'ledger' ? ledger(s) : tab === 'loans' ? loans(s) : tab === 'marketing' ? marketing(s) : bids(s)}
  `;
}

export const financeScreen: Screen = {
  id: 'finance',
  render,
  handlers: {
    tab: (el) => { ui.financeTab = (el.dataset.id as typeof ui.financeTab) || 'overview'; rerender(); },
    insure: async (el) => {
      const on = (el as HTMLInputElement).checked;
      if (!on && store.state.staff.length) {
        const ok = await confirmDialog({ title: 'Cancel insurance?', body: 'Staff and commercial contracts require it, and damage claims come out of your cash.', ok: 'Cancel insurance', cancel: 'Keep it', danger: true });
        if (!ok) { (el as HTMLInputElement).checked = true; return; }
      }
      act(() => sim.setInsurance(store.state, on));
    },
    loanAmt: (el) => {
      ui.loanAmount = Number((el as HTMLInputElement).value) || 0;
      // Live preview without a full re-render (keeps the slider under the finger)
      const page = el.closest('.ui-card');
      const offer = safe(() => sim.loanOffer(store.state), { limit: 0, apr: 0.09, terms: [26] });
      const pay = weeklyPayment(ui.loanAmount, offer.apr, ui.loanWeeks);
      const max = Number((el as HTMLInputElement).max) || 1;
      (el as HTMLInputElement).style.setProperty('--p', String(max > 100 ? ((ui.loanAmount - 100) / (max - 100)) * 100 : 100));
      if (page) {
        const set = (sel: string, v: string) => { const n = page.querySelector(sel); if (n) n.textContent = v; };
        set('.ui-loan-amt', money(ui.loanAmount));
        set('.ui-loan-btn', money(ui.loanAmount));
        set('.ui-loan-pay', money(pay, true));
        set('.ui-loan-int', money(pay * ui.loanWeeks - ui.loanAmount, true));
      }
    },
    loanWeeks: (el) => { ui.loanWeeks = Number(el.dataset.w) || 26; rerender(); },
    takeLoan: async () => {
      const offer = safe(() => sim.loanOffer(store.state), null);
      if (!offer) return;
      const pay = weeklyPayment(ui.loanAmount, offer.apr, ui.loanWeeks);
      const ok = await confirmDialog({ title: `Borrow ${money(ui.loanAmount)}?`, body: `${money(pay, true)} every week for ${ui.loanWeeks} weeks.`, ok: 'Borrow' });
      if (ok && act(() => sim.takeLoan(store.state, ui.loanAmount, ui.loanWeeks), { sound: 'cash' })) ui.loanAmount = 0;
    },
    repay: (el) => {
      const s = store.state;
      const amt = Math.min(Number(el.dataset.b) || 0, Math.max(0, s.cash));
      if (amt > 0) act(() => sim.repayLoan(s, el.dataset.id || '', amt), { sound: 'cash' });
    },
    mkt: (el) => {
      const kind = el.dataset.kind as 'flyers' | 'hangers' | 'newspaper';
      const key = el.dataset.key || '';
      // Newspaper ads target a whole town: pass that town's first neighborhood key so the sim can read the town id.
      const hoodKey = kind === 'newspaper' ? `${key}.maple` : key;
      act(() => sim.buyMarketing(store.state, kind, hoodKey), { sound: 'cash' });
    },
    bidDraft: (el) => { ui.bidDrafts[el.dataset.id || ''] = (el as HTMLInputElement).value; },
    bid: (el) => {
      const id = el.dataset.id || '';
      const b = store.state.bids.find((x) => x.id === id);
      const v = Math.round(Number(ui.bidDrafts[id] ?? b?.fairPrice ?? 0));
      if (!Number.isFinite(v) || v <= 0) return;
      if (act(() => sim.placeBid(store.state, id, v))) delete ui.bidDrafts[id];
    },
  },
};
