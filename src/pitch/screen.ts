// The neighborhood screen: 3D diorama, house list, house card, knocking and the pitch overlay.
import type { Client, GameState, HouseView, JobTicket, KnockResult, PitchContext, PitchOutcome } from '../core/types';
import { ARCHETYPE_BY_ID } from '../data/archetypes';
import { HOOD_BY_ID, TOWN_BY_ID, splitHoodKey } from '../data/hoods';
import { NOBODY_HOME, NO_SOLICITING } from '../data/dialogue';
import { pickFresh } from '../data/pick';
import { bus } from '../core/bus';
import { clock, duration, money } from '../core/format';
import { hashSeed, makeRng } from '../core/rng';
import { loadSettings } from '../core/save';
import { audio } from '../audio';
import { ADDON_LABEL } from '../sim/negotiation';
import { api, safe } from './api';
import { Diorama, type MarkerKind } from './diorama';
import { PitchScreen } from './pitchScreen';
import { el, esc, portrait } from './avatar';
import { ensurePitchStyles } from './styles';

export interface NeighborhoodCallbacks {
  onStartJob(clientId: string): void;
  onExit(): void;
}

type SortMode = 'status' | 'grass' | 'size' | 'address';
interface Status { kind: MarkerKind; label: string; color?: string; order: number }

const ICON: Record<MarkerKind, string> = {
  client: '<svg class="pitch-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lead: '<svg class="pitch-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.9 4.1 4.4.4-3.3 3 1 4.4L8 11.1 4 13.4l1-4.4-3.3-3 4.4-.4z" fill="currentColor"/></svg>',
  hoa: '<svg class="pitch-ic" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="1.5" width="10" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  rival: '<svg class="pitch-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 15V2M4 2.5h8l-2 3 2 3H4" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg>',
  cold: '<svg class="pitch-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M2.4 4.8l11.2 6.4M2.4 11.2l11.2-6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  nosolicit: '<svg class="pitch-ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3.8 3.8l8.4 8.4" stroke="currentColor" stroke-width="2.4"/></svg>',
  none: '',
};
const CLOCK_SVG = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="#fff" stroke="#2f3a2c" stroke-width="2"/><path d="M10 5.5V10l3 2" stroke="#2f3a2c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

export class NeighborhoodScreen {
  readonly root: HTMLElement;
  private diorama: Diorama | null = null;
  private views: HouseView[] = [];
  private selected: string | null = null;
  private sort: SortMode = 'status';
  private pitch: PitchScreen | null = null;
  private knocking = false;
  private disposed = false;
  private unsub: () => void;
  private refreshQueued = false;
  private tutorialId: string | null = null;
  private tutorialFocused = false;
  private els: { title: HTMLElement; clock: HTMLElement; list: HTMLElement; listBody: HTMLElement; listCount: HTMLElement; card: HTMLElement; toasts: HTMLElement; hint: HTMLElement; stage: HTMLElement };
  private onKey = (e: KeyboardEvent) => {
    if (this.pitch || this.disposed) return;
    if (e.key === 'Escape' && this.selected) { e.preventDefault(); this.select(null); }
  };

  constructor(private host: HTMLElement, readonly hoodKey: string, private cb: NeighborhoodCallbacks) {
    ensurePitchStyles();
    this.root = el('div', 'pitch-root');
    this.root.innerHTML = `
      <div class="pitch-stage"></div>
      <div class="pitch-top">
        <button class="pitch-btn pitch-btn-ghost" data-act="back" type="button" aria-label="Back to map">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M12.5 4L6.5 10l6 6" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Map</span>
        </button>
        <div class="pitch-title pitch-panelbox"><h1></h1><p></p></div>
        <div class="pitch-spacer"></div>
        <button class="pitch-btn pitch-btn-ghost pitch-listtoggle" data-act="list" type="button" aria-expanded="false">Houses</button>
        <div class="pitch-clock pitch-panelbox" aria-live="polite"></div>
      </div>
      <aside class="pitch-list pitch-panelbox" aria-label="Houses">
        <div class="pitch-list-head">
          <h2>Houses <span class="pitch-list-count"></span></h2>
          <div class="pitch-sort" role="group" aria-label="Sort houses">
            <button type="button" class="pitch-sortbtn" data-sort="status">Status</button>
            <button type="button" class="pitch-sortbtn" data-sort="grass">Grass</button>
            <button type="button" class="pitch-sortbtn" data-sort="size">Size</button>
            <button type="button" class="pitch-sortbtn" data-sort="address">Address</button>
          </div>
        </div>
        <div class="pitch-list-body"></div>
      </aside>
      <section class="pitch-card pitch-panelbox" hidden aria-live="polite"></section>
      <div class="pitch-zoom">
        <button class="pitch-btn pitch-btn-ghost" data-act="zoom-in" type="button" aria-label="Zoom in">+</button>
        <button class="pitch-btn pitch-btn-ghost" data-act="zoom-out" type="button" aria-label="Zoom out">-</button>
        <button class="pitch-btn pitch-btn-ghost" data-act="fit" type="button" aria-label="Show whole neighborhood"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg></button>
      </div>
      <div class="pitch-hint pitch-panelbox" hidden></div>
      <div class="pitch-toasts" role="status" aria-live="polite"></div>`;
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.els = {
      title: q('.pitch-title'), clock: q('.pitch-clock'), list: q('.pitch-list'), listBody: q('.pitch-list-body'),
      listCount: q('.pitch-list-count'), card: q('.pitch-card'), toasts: q('.pitch-toasts'), hint: q('.pitch-hint'), stage: q('.pitch-stage'),
    };
    host.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('keydown', this.onKey);
    this.unsub = bus.on('state:changed', () => this.queueRefresh());

    const settings = loadSettings();
    let color = '#2f8f4e';
    try { color = api.state().company.color || color; } catch { /* no game loaded */ }
    this.root.style.setProperty('--co', color);
    try {
      this.diorama = new Diorama(this.els.stage, {
        companyColor: color,
        shadows: settings.shadows,
        reducedMotion: settings.reducedMotion,
        onPick: (id) => this.select(id, false),
      });
    } catch (e) {
      console.warn('[pitch] 3D view unavailable', e);
      this.root.classList.add('no-3d');
    }
    this.refresh();
  }

  // ---------------------------------------------------------------- data
  private get state(): GameState { return api.state(); }

  refresh(): void {
    if (this.disposed) return;
    let s: GameState;
    try { s = this.state; } catch { this.showEmpty('No game loaded.'); return; }
    let err = '';
    this.views = safe(() => api.housesInHood(s, this.hoodKey), [] as HouseView[]);
    if (!this.views.length) {
      try { api.housesInHood(s, this.hoodKey); } catch (e) { err = (e as Error).message; }
      this.showEmpty(err ? 'This neighborhood is not ready yet.' : 'No houses here.');
      console.warn('[pitch] neighborhood empty', err);
    } else {
      this.root.querySelector('.pitch-empty')?.remove();
    }
    this.renderHeader();
    this.diorama?.setHouses(this.views);
    this.renderMarkers();
    this.renderList();
    this.renderCard();
    this.renderTutorial();
  }

  private queueRefresh(): void {
    if (this.refreshQueued || this.disposed) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => { this.refreshQueued = false; this.refresh(); });
  }

  private view(id: string | null): HouseView | undefined { return id ? this.views.find((v) => v.info.id === id) : undefined; }

  private met(v: HouseView): boolean {
    if (v.client || v.state.exClient || v.state.coldUntil !== undefined) return true;
    try { return !!this.state.flags[`met.${v.info.id}`]; } catch { return false; }
  }

  private statusOf(v: HouseView): Status {
    if (v.client) return { kind: 'client', label: v.client.trial ? 'Trial client' : 'Your client', order: 5 };
    if (v.info.noSoliciting) return { kind: 'nosolicit', label: 'No soliciting', order: 7 };
    if (v.cold) return { kind: 'cold', label: 'Not interested for now', order: 6 };
    if (v.lead) return { kind: 'lead', label: 'Warm lead', order: 0 };
    if (v.hoa) return { kind: 'hoa', label: 'Got an HOA letter', order: 1 };
    if (v.provider === 'rival' && v.rival) return { kind: 'rival', label: `Uses ${v.rival.name}`, color: v.rival.color, order: 3 };
    if (v.grassIn > 5.5) return { kind: 'none', label: 'Overgrown lawn', order: 2 };
    return { kind: 'none', label: v.provider === 'diy' ? 'Mows it themselves' : 'No lawn service', order: 4 };
  }

  private tickets(): JobTicket[] {
    return safe(() => api.jobsToday(this.state), [] as JobTicket[]);
  }

  // ---------------------------------------------------------------- header, markers, list
  private renderHeader(): void {
    const { townId, hoodId } = splitHoodKey(this.hoodKey);
    const hood = HOOD_BY_ID[hoodId];
    const town = TOWN_BY_ID[townId];
    let s: GameState | null = null;
    try { s = this.state; } catch { /* none */ }
    const cal = s ? safe(() => api.calendar(s!.day), null) : null;
    const clients = this.views.filter((v) => v.client).length;
    const leads = this.views.filter((v) => v.lead && !v.client).length;
    this.els.title.querySelector('h1')!.textContent = hood?.name ?? 'Neighborhood';
    const bits = [town?.name, cal ? `${cal.weekdayName}, ${cal.label}` : null, `${clients} ${clients === 1 ? 'client' : 'clients'}`];
    if (leads) bits.push(`${leads} ${leads === 1 ? 'lead' : 'leads'}`);
    this.els.title.querySelector('p')!.textContent = bits.filter(Boolean).join('  |  ');
    if (s) {
      const left = safe(() => api.ownerMinutesLeft(s!), Math.max(0, 1170 - s.owner.minute));
      this.els.clock.innerHTML = `<span class="pitch-clock-icon">${CLOCK_SVG}</span><span><div class="pitch-clock-time">${clock(s.owner.minute)}</div><div class="pitch-clock-left">${left > 0 ? `${duration(left)} left` : 'Day is over'}</div></span>`;
      this.els.clock.classList.toggle('is-late', left < 60);
    }
  }

  private renderMarkers(): void {
    if (!this.diorama) return;
    for (const v of this.views) {
      const st = this.statusOf(v);
      const html = `<span class="pitch-pin pitch-st-${st.kind}"${st.color ? ` style="--mk:${esc(st.color)}"` : ''}>${ICON[st.kind]}</span><span class="pitch-mlabel">${esc(v.info.address)}</span>`;
      this.diorama.setMarker(v.info.id, st.kind, html, st.label, st.color);
    }
  }

  private renderList(): void {
    const rows = [...this.views];
    const st = new Map(rows.map((v) => [v.info.id, this.statusOf(v)]));
    const byAddr = (a: HouseView, b: HouseView) => a.info.street.localeCompare(b.info.street) || a.info.number - b.info.number;
    rows.sort((a, b) => {
      switch (this.sort) {
        case 'status': return st.get(a.info.id)!.order - st.get(b.info.id)!.order || b.grassIn - a.grassIn || byAddr(a, b);
        case 'grass': return b.grassIn - a.grassIn || byAddr(a, b);
        case 'size': return b.info.lawnM2 - a.info.lawnM2 || byAddr(a, b);
        default: return byAddr(a, b);
      }
    });
    this.els.listCount.textContent = `${rows.length}`;
    this.root.querySelectorAll<HTMLElement>('.pitch-sortbtn').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.sort === this.sort);
      b.setAttribute('aria-pressed', String(b.dataset.sort === this.sort));
    });
    this.els.listBody.innerHTML = rows.map((v) => {
      const s = st.get(v.info.id)!;
      const met = this.met(v);
      const pct = Math.min(100, Math.round((v.grassIn / 8) * 100));
      const sub = met ? `${v.info.ownerName}, ${s.label.toLowerCase()}` : s.label;
      return `<button type="button" class="pitch-row${v.info.id === this.selected ? ' is-selected' : ''}" data-house="${esc(v.info.id)}">
        <span class="pitch-dot pitch-st-${s.kind}"${s.color ? ` style="--mk:${esc(s.color)}"` : ''}>${ICON[s.kind] || ''}</span>
        <span style="min-width:0"><div class="pitch-row-addr">${esc(v.info.address)}</div><div class="pitch-row-sub">${esc(sub)}</div></span>
        <span class="pitch-row-grass${v.grassIn > 5.5 ? ' is-tall' : ''}" title="Grass ${v.grassIn.toFixed(1)} in"><span style="width:${pct}%"></span></span>
      </button>`;
    }).join('');
  }

  // ---------------------------------------------------------------- house card
  private renderCard(): void {
    const card = this.els.card;
    if (this.knocking) return;   // keep the door animation on screen; knock() refreshes when it ends
    const v = this.view(this.selected);
    this.root.classList.toggle('has-card', !!v);
    if (!v) { card.hidden = true; card.innerHTML = ''; return; }
    card.hidden = false;
    const s = this.state;
    const st = this.statusOf(v);
    const met = this.met(v);
    const arch = ARCHETYPE_BY_ID[v.info.archetypeId];
    const fair = safe(() => api.fairPrice(v.info.lawnM2, 7, v.info.lot.kind), 0);
    const provider = v.client ? 'You' : v.provider === 'rival' ? (v.rival?.name ?? 'Another company') : v.provider === 'diy' ? 'The owner' : 'Nobody';
    const c = v.client;
    const knockMin = this.knockMinutes();
    const ticket = c ? this.tickets().find((t) => t.clientId === c.id) : undefined;
    const today = s.day;

    let actions = '';
    if (c) {
      if (ticket && !ticket.done) actions += `<button class="pitch-btn pitch-btn-go pitch-btn-knock" data-act="mow" type="button">Mow now <small>${ticket.daysOverdue > 0 ? `${ticket.daysOverdue} ${ticket.daysOverdue === 1 ? 'day' : 'days'} late` : 'due today'}</small></button>`;
      else actions += `<button class="pitch-btn pitch-btn-ghost" type="button" disabled>${c.lastServiceDay === today ? 'Mowed today' : `Next visit ${dayLabel(c.nextDueDay, today)}`}</button>`;
    } else {
      actions += `<button class="pitch-btn pitch-btn-sun pitch-btn-knock" data-act="knock" type="button" ${v.canKnock ? '' : 'disabled'}>Knock <small>${knockMin.label}</small></button>`;
    }
    const reason = !c && !v.canKnock ? (v.info.noSoliciting ? `The sign says: "${pickSign(v.info.propertySeed)}"` : v.reason) : '';

    card.innerHTML = `
      <div class="pitch-card-head">
        <div class="pitch-card-portrait"></div>
        <div style="min-width:0">
          <h2>${esc(v.info.address)}</h2>
          <p>${met ? `${esc(v.info.ownerName)}, ${esc(arch?.label ?? 'Homeowner')}` : 'Owner not met yet'}</p>
        </div>
        <button class="pitch-x" data-act="close-card" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="pitch-card-body">
        <div class="pitch-status-line"><span class="pitch-dot pitch-st-${st.kind}"${st.color ? ` style="--mk:${esc(st.color)}"` : ''}>${ICON[st.kind]}</span><span>${esc(st.label)}</span></div>
        ${met && arch ? `<p class="pitch-flavorline">${esc(arch.flavor)}</p>` : ''}
        <dl class="pitch-facts">
          <div class="pitch-fact"><dt>Lawn</dt><dd>${Math.round(v.info.lawnSqft).toLocaleString('en-US')} <small>sq ft</small></dd></div>
          <div class="pitch-fact"><dt>Grass</dt><dd>${v.grassIn.toFixed(1)} <small>in</small></dd><div class="pitch-grassbar"><span style="width:${Math.min(100, Math.round(v.grassIn / 8 * 100))}%"></span></div></div>
          <div class="pitch-fact"><dt>Mowed by</dt><dd>${esc(provider)}</dd></div>
          <div class="pitch-fact"><dt>${c ? 'Your price' : 'Going rate'}</dt><dd>${c ? money(c.price) : fair ? money(fair) : '-'} <small>per mow</small></dd></div>
        </dl>
        <div class="pitch-card-actions">${actions}</div>
        ${reason ? `<p class="pitch-reason">${esc(reason)}</p>` : ''}
        ${c ? this.clientDetails(c) : ''}
      </div>`;
    card.querySelector('.pitch-card-portrait')!.appendChild(portrait(v.info.portrait, v.info.ownerName, { unknown: !met }));
  }

  private clientDetails(c: Client): string {
    const s = this.state;
    const sat = Math.round(c.satisfaction);
    const satCol = sat >= 70 ? '#4f9d3a' : sat >= 50 ? '#e0b22a' : '#de5a45';
    const satLabel = sat >= 85 ? 'Delighted' : sat >= 65 ? 'Happy' : sat >= 50 ? 'Okay' : sat >= 35 ? 'Unhappy' : 'About to leave';
    return `<details class="pitch-details">
      <summary>Client details</summary>
      <dl class="pitch-kv">
        <dt>Price</dt><dd>${money(c.price)} ${c.freq === 14 ? 'every 2 weeks' : 'weekly'}</dd>
        <dt>Add-ons</dt><dd>${c.addOns.length ? c.addOns.map((a) => ADDON_LABEL[a]).join(', ') : 'None'}</dd>
        <dt>Client since</dt><dd>${dayLabel(c.since, s.day)}</dd>
        <dt>Visits</dt><dd>${c.visits}</dd>
        <dt>Last quality</dt><dd>${c.lastQ >= 0 ? Math.round(c.lastQ) : 'Not mowed yet'}</dd>
        <dt>Next visit</dt><dd>${dayLabel(c.nextDueDay, s.day)}</dd>
        <dt>Satisfaction</dt><dd>${satLabel}</dd>
      </dl>
      <div class="pitch-satbar" title="Satisfaction ${sat}"><span style="width:${sat}%;background:${satCol}"></span></div>
    </details>`;
  }

  private knockMinutes(): { total: number; label: string } {
    let s: GameState;
    try { s = this.state; } catch { return { total: 4, label: '4 min' }; }
    const knock = s.owner.perks.includes('door_pro') ? 2 : 4;
    const loc = s.owner.location;
    const travel = loc && loc !== this.hoodKey ? safe(() => api.travelMinutes(s, loc, this.hoodKey), 0) : 0;
    const total = Math.round(knock + travel);
    return { total, label: travel > 0 ? `${total} min with travel` : `${total} min` };
  }

  private renderTutorial(): void {
    let on = false;
    try { on = this.state.flags.tutorial === 1; } catch { /* none */ }
    const { townId } = splitHoodKey(this.hoodKey);
    const id = `${townId}.maple.0`;
    const v = on ? this.view(id) : undefined;
    const active = !!v && !v.client;
    this.tutorialId = active ? id : null;
    this.diorama?.setTutorial(this.tutorialId);
    if (active && !this.tutorialFocused) { this.tutorialFocused = true; this.diorama?.focusOn(id); }
    const hint = this.els.hint;
    if (!active || !v) { hint.hidden = true; return; }
    hint.hidden = false;
    const first = v.info.ownerName.split(' ')[0];
    hint.innerHTML = `<span class="pitch-hint-arrow"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2.5l1.7 3.6 4 .4-3 2.7.9 3.9L8 11.1 4.4 13.1l.9-3.9-3-2.7 4-.4z" fill="#2f3a2c"/></svg></span>
      <span>Start with ${esc(first)} at ${esc(v.info.address)}. Tap the house, then Knock.</span>
      ${this.selected === id ? '' : `<button class="pitch-btn pitch-btn-sun pitch-btn-small" data-act="tutorial" type="button">Show</button>`}`;
  }

  // ---------------------------------------------------------------- interaction
  private onClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('[data-house]');
    if (row) { this.select(row.dataset.house!); return; }
    const sort = t.closest<HTMLElement>('[data-sort]');
    if (sort) { this.sort = sort.dataset.sort as SortMode; audio.play('click', { volume: 0.4 }); this.renderList(); return; }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    switch (act) {
      case 'back': audio.play('click', { volume: 0.5 }); this.cb.onExit(); break;
      case 'list': {
        const on = !this.root.classList.contains('show-list');
        this.root.classList.toggle('show-list', on);
        t.closest('[data-act]')!.setAttribute('aria-expanded', String(on));
        if (on) this.select(null);
        break;
      }
      case 'close-card': this.select(null); break;
      case 'zoom-in': this.diorama?.zoomBy(0.78); break;
      case 'zoom-out': this.diorama?.zoomBy(1.28); break;
      case 'fit': this.diorama?.focusAll(); break;
      case 'tutorial': if (this.tutorialId) this.select(this.tutorialId); break;
      case 'knock': if (this.selected) void this.knock(this.selected); break;
      case 'mow': {
        const v = this.view(this.selected);
        if (v?.client) { audio.play('click', { volume: 0.5 }); this.cb.onStartJob(v.client.id); }
        break;
      }
    }
  }

  select(id: string | null, focus = true): void {
    if (this.knocking) return;
    this.selected = id && this.view(id) ? id : null;
    this.diorama?.select(this.selected, focus);
    if (this.selected) {
      audio.play('click', { volume: 0.35 });
      if (window.matchMedia('(max-width: 860px)').matches) this.root.classList.remove('show-list');
    }
    this.renderList();
    this.renderCard();
    this.renderTutorial();
    const row = this.selected ? this.els.listBody.querySelector<HTMLElement>(`[data-house="${cssEsc(this.selected)}"]`) : null;
    row?.scrollIntoView({ block: 'nearest' });
  }

  private async knock(id: string): Promise<void> {
    const v = this.view(id);
    if (!v || this.knocking || this.pitch) return;
    if (!v.canKnock) { this.toast(v.reason || 'Not now.', 'bad'); return; }
    this.knocking = true;
    const fx = el('div', 'pitch-knockfx is-knocking', `<div class="pitch-knockfx-wrap"><div class="pitch-knockfx-door"></div><div class="pitch-knockfx-text">Knock knock</div></div>`);
    this.els.card.appendChild(fx);
    const rng = makeRng(hashSeed(id, this.safeDay(), this.safeMinute()));
    audio.play(rng.chance(0.5) ? 'doorbell' : 'knock');
    let res: KnockResult;
    try {
      res = api.knock(this.state, id);
    } catch (e) {
      console.warn('[pitch] knock failed', e);
      res = { ok: false, answered: false, minutes: 0, message: 'Knocking is not available right now.', context: null };
    }
    if (res.ok) safe(() => api.commit(), undefined);
    await wait(this.reduced() ? 0 : 1250);
    if (this.disposed) return;
    if (!res.ok) {
      fx.remove();
      this.knocking = false;
      this.toast(res.message, 'bad');
      this.refresh();
      return;
    }
    if (res.answered && res.context) {
      fx.classList.remove('is-knocking');
      fx.classList.add('is-answered');
      fx.querySelector('.pitch-knockfx-text')!.textContent = 'Someone is coming';
      audio.play('door_open');
      await wait(this.reduced() ? 0 : 480);
      if (this.disposed) return;
      fx.remove();
      this.knocking = false;
      this.markMet(id);
      this.openPitch(id, res.context);
    } else {
      fx.remove();
      this.knocking = false;
      this.refresh();
      // Someone answered but turned the pitch down at the door (the sim marks the house cold).
      const after = this.view(id);
      if (after?.cold && res.message) this.toast(res.message, 'info');
      else this.toast(pickFresh(rng, NOBODY_HOME), 'info');
    }
  }

  private openPitch(id: string, ctx: PitchContext): void {
    const s = this.state;
    const full: PitchContext = { ...ctx, companyName: ctx.companyName || s.company.name };
    this.pitch = new PitchScreen(this.root, {
      ctx: full,
      seed: hashSeed(s.seed, id, s.day, s.owner.minute, s.stats.knocks),
      companyColor: s.company.color,
      onClose: (outcome) => { this.pitch = null; this.finishPitch(id, outcome); },
    });
  }

  private finishPitch(id: string, outcome: PitchOutcome): void {
    const v = this.view(id);
    let msg = '';
    let ok = true;
    try {
      const r = api.applyPitchOutcome(this.state, id, outcome);
      ok = r.ok;
      msg = r.message;
    } catch (e) {
      console.warn('[pitch] applyPitchOutcome failed', e);
      ok = false;
      msg = 'Could not save this pitch.';
    }
    safe(() => api.commit(), undefined);
    this.refresh();
    const addr = v?.info.address ?? '';
    const f = outcome.freq === 14 ? 'every 2 weeks' : 'weekly';
    if (!ok) this.toast(msg || 'Could not save this pitch.', 'bad');
    else if (outcome.result === 'deal') this.toast(`New client at ${addr}. ${money(outcome.price ?? 0)} ${f}.`, 'good');
    else if (outcome.result === 'trial') this.toast(`Free first mow booked at ${addr}.`, 'good');
    else if (outcome.result === 'cold') this.toast('They want to think about it. Try again in 5 days.', 'info');
    else if (outcome.result === 'rejected') this.toast('Door closed. Try another house.', 'bad');
    this.select(id, false);
    this.canvasFocus();
  }

  private markMet(id: string): void {
    try { this.state.flags[`met.${id}`] = true; } catch { /* none */ }
  }

  private canvasFocus(): void { this.diorama?.canvas.focus({ preventScroll: true }); }

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    const t = el('div', `pitch-toast pitch-toast-${kind}`);
    t.textContent = text;
    this.els.toasts.appendChild(t);
    while (this.els.toasts.children.length > 3) this.els.toasts.firstElementChild?.remove();
    window.setTimeout(() => { t.classList.add('is-out'); window.setTimeout(() => t.remove(), 320); }, 3400);
  }

  private showEmpty(text: string): void {
    this.root.querySelector('.pitch-empty')?.remove();
    const e = el('div', 'pitch-empty', `<div class="pitch-panelbox"><p>${esc(text)}</p><button class="pitch-btn pitch-btn-go" data-act="back" type="button">Back to map</button></div>`);
    this.root.appendChild(e);
  }

  private safeDay(): number { try { return this.state.day; } catch { return 0; } }
  private safeMinute(): number { try { return this.state.owner.minute; } catch { return 0; } }
  private reduced(): boolean { return loadSettings().reducedMotion; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsub();
    document.removeEventListener('keydown', this.onKey);
    this.pitch?.dispose();
    this.pitch = null;
    this.diorama?.dispose();
    this.diorama = null;
    this.root.remove();
  }
}

function wait(ms: number): Promise<void> { return new Promise((r) => (ms > 0 ? setTimeout(r, ms) : r())); }
function cssEsc(s: string): string { return s.replace(/["\\]/g, '\\$&'); }
function pickSign(seed: number): string { return NO_SOLICITING[seed % NO_SOLICITING.length]; }
function dayLabel(day: number, today: number): string {
  const d = day - today;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1) return `in ${d} days`;
  return `${-d} days ago`;
}
