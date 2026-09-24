// App shell: sidebar nav, top status bar, bottom tabs, screen lifecycle and keyboard shortcuts.
import * as sim from '../sim';
import { store } from '../core/store';
import { bus } from '../core/bus';
import { audio } from '../audio';
import { money, clock, duration } from '../core/format';
import { html, raw, delegate, type Raw } from './html';
import { icon, weatherIcon } from './icons';
import { onRoute, parseHash, navigate, replaceRoute, type Route } from './router';
import type { Screen } from './screen';
import { safe, calSafe, ring, countUp, WEATHER_LABEL, WEATHER_NOTE, WEEKDAYS_LONG, bar, clamp } from './kit';
import { closePopover, modalOpen, openModal, popover, popoverOpen, toast } from './overlay';
import { prefs } from './prefs';
import { ui } from './uistate';

import { titleScreen } from './screens/title';
import { hubScreen } from './screens/hub';
import { mapScreen, hoodScreen } from './screens/map';
import { clientsScreen } from './screens/clients';
import { crewScreen } from './screens/crew';
import { garageScreen } from './screens/garage';
import { financeScreen } from './screens/finance';
import { businessScreen } from './screens/business';
import { skillsScreen } from './screens/skills';
import { settingsScreen } from './screens/settings';
import { resultScreen } from './screens/result';
import { reportScreen } from './screens/report';
import { endDayFlow } from './flows';

const SCREENS: Record<string, Screen> = {
  title: titleScreen,
  hub: hubScreen,
  map: mapScreen,
  hood: hoodScreen,
  clients: clientsScreen,
  crew: crewScreen,
  garage: garageScreen,
  finance: financeScreen,
  business: businessScreen,
  skills: skillsScreen,
  settings: settingsScreen,
  result: resultScreen,
  report: reportScreen,
};

interface NavItem { id: string; label: string; icon: string; key?: string }
const NAV: NavItem[] = [
  { id: 'hub', label: 'Today', icon: 'today', key: '1' },
  { id: 'map', label: 'Map', icon: 'map', key: '2' },
  { id: 'clients', label: 'Clients', icon: 'house', key: '3' },
  { id: 'crew', label: 'Crew', icon: 'crew', key: '4' },
  { id: 'garage', label: 'Garage', icon: 'mower', key: '5' },
  { id: 'finance', label: 'Finance', icon: 'bank', key: '6' },
  { id: 'business', label: 'Business', icon: 'chart', key: '7' },
  { id: 'skills', label: 'Skills', icon: 'skills' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];
const TABS = ['hub', 'map', 'clients', 'garage'];
const MORE = ['crew', 'finance', 'business', 'skills', 'settings'];

// Which nav item lights up for a screen
const NAV_OWNER: Record<string, string> = { hood: 'map', result: 'hub', report: 'hub' };

let appEl: HTMLElement;
let sideEl: HTMLElement;
let topEl: HTMLElement;
let mainEl: HTMLElement;
let tabsEl: HTMLElement;
let titleHost: HTMLElement;
export let fullscreenHost: HTMLElement;

let current: Screen | null = null;
let currentRoute: Route = { screen: 'title', params: [] };
let shownCash: number | null = null;
let rendering = false;

export function initApp(root: HTMLElement): void {
  root.innerHTML = html`
    <div class="ui-app is-hidden">
      <aside class="ui-side" aria-label="Main"></aside>
      <header class="ui-top"></header>
      <main class="ui-main" id="ui-main" tabindex="-1"></main>
      <nav class="ui-tabs" aria-label="Main"></nav>
    </div>
    <div class="ui-title-host"></div>
    <div class="ui-fullscreen"></div>
  `.s;
  appEl = root.querySelector('.ui-app')!;
  sideEl = root.querySelector('.ui-side')!;
  topEl = root.querySelector('.ui-top')!;
  mainEl = root.querySelector('.ui-main')!;
  tabsEl = root.querySelector('.ui-tabs')!;
  titleHost = root.querySelector('.ui-title-host')!;
  fullscreenHost = root.querySelector('.ui-fullscreen')!;

  delegate(mainEl, () => current?.handlers);
  delegate(titleHost, () => titleScreen.handlers);
  const navHandlers = {
    nav: (el: HTMLElement) => { closePopover(); navigate(el.dataset.id || 'hub'); },
    more: () => openMoreSheet(),
  };
  delegate(sideEl, () => navHandlers);
  delegate(tabsEl, () => navHandlers);
  delegate(topEl, () => topHandlers);

  onRoute(show);
  bus.on('state:changed', onStateChanged);
  bus.on('navigate', ({ screen, params }) => navigate(screen, ...((params?.args as string[]) || [])));
  document.addEventListener('keydown', onKey);
}

export function startRouting(): void {
  // Boot always lands on the title.
  replaceRoute('title');
}

// ---------------------------------------------------------------- screen lifecycle
function show(r: Route): void {
  let screen = SCREENS[r.screen];
  if (!screen) { replaceRoute(store.loaded ? 'hub' : 'title'); return; }
  if (screen.needsGame !== false && !store.loaded) { replaceRoute('title'); return; }
  closePopover();
  const same = current === screen && currentRoute.params.join('/') === r.params.join('/');
  if (current && (current !== screen || !same)) {
    try { current.unmount?.(); } catch (e) { console.error(e); }
  }
  current = screen;
  currentRoute = r;
  ui.lastRoute = r;

  // music
  const music = screen.music !== undefined ? screen.music : 'music_hub';
  try { audio.music(music); } catch { /* ignore */ }

  if (screen.bare) {
    appEl.classList.add('is-hidden');
    titleHost.style.display = '';
    titleHost.innerHTML = '';
    screen.mount?.(titleHost, r.params);
    return;
  }
  titleHost.style.display = 'none';
  titleHost.innerHTML = '';
  appEl.classList.remove('is-hidden');
  renderChrome();
  if (screen.mount) {
    mainEl.classList.add('is-bleed');
    mainEl.innerHTML = '<div class="ui-bleed"></div>';
    screen.mount(mainEl.firstElementChild as HTMLElement, r.params);
  } else {
    mainEl.classList.remove('is-bleed');
    renderMain(true);
  }
}

function renderMain(first: boolean): void {
  if (!current || !current.render) return;
  if (rendering) return;
  rendering = true;
  try {
    const scroll = mainEl.scrollTop;
    let content: Raw;
    try {
      content = current.render(currentRoute.params);
    } catch (e) {
      console.error(e);
      content = html`<div class="ui-empty">${raw(icon('leaf'))}<h3>This page could not load.</h3><p>Try another tab.</p></div>`;
    }
    mainEl.innerHTML = `<div class="ui-page${first ? '' : ' ui-page--static'}">${content.s}</div>`;
    if (first) mainEl.scrollTop = 0;
    else mainEl.scrollTop = scroll;
    try { current.after?.(mainEl, first, currentRoute.params); } catch (e) { console.error(e); }
  } finally {
    rendering = false;
  }
}

// Daily goals finished since the last state change get a toast (the result screen lists them itself).
let goalsSeen = '';
function announceGoals(): void {
  const g = store.state.goals;
  if (!g) return;
  const key = (x: { label: string }) => `${g.day}|${x.label}`;
  const done = g.list.filter((x) => x.done);
  const seen = new Set(goalsSeen.split('\n'));
  const fresh = goalsSeen.startsWith(`${g.day}|`) || goalsSeen === `${g.day}|` ? done.filter((x) => !seen.has(key(x))) : [];
  goalsSeen = [`${g.day}|`, ...done.map(key), g.sweep ? `${g.day}|sweep` : ''].join('\n');
  if (current?.id === 'result') return;
  for (const x of fresh) toast(`Goal complete: ${x.label}. +${money(x.reward)}`, 'good');
  if (g.sweep && !seen.has(`${g.day}|sweep`) && fresh.length) toast('Clean sweep: every goal done today.', 'good');
  if (fresh.length) try { audio.play('tip'); } catch { /* ignore */ }
}

function onStateChanged(): void {
  if (!store.loaded) return;
  announceGoals();
  if (!current || current.bare) return;
  renderChrome();
  if (current.mount) { try { current.refresh?.(); } catch (e) { console.error(e); } return; }
  renderMain(false);
}

/** Force a re-render of the current screen (UI-only state changes). */
export function rerender(): void {
  if (current && !current.bare && !current.mount) renderMain(false);
}

// ---------------------------------------------------------------- chrome
function activeNav(): string { return NAV_OWNER[currentRoute.screen] || currentRoute.screen; }

function renderChrome(): void {
  if (!store.loaded) return;
  const s = store.state;
  document.documentElement.style.setProperty('--ui-company', s.company.color || '#2f6f3a');
  const lvl = safe(() => sim.ownerLevel(s), { level: s.owner.level || 1, xp: s.owner.xp, xpForNext: 100, xpIntoLevel: 0, progress: 0, skillPoints: s.owner.skillPoints });
  const due = ownerJobsDue();
  const badges: Record<string, Raw | ''> = {
    hub: due > 0 ? html`<span class="ui-badge-num">${due}</span>` : '',
    skills: lvl.skillPoints > 0 ? html`<span class="ui-badge-num">${lvl.skillPoints}</span>` : '',
  };
  const act = activeNav();
  sideEl.innerHTML = html`
    <a class="ui-brand" href="#/hub" aria-label="Mow Money">
      <span class="ui-brand__mark">${raw(icon('mower'))}</span>
      <span class="ui-brand__name">Mow Money<small>Lawn care empire</small></span>
    </a>
    <div class="ui-nav">
      ${NAV.map((n, i) => html`
        ${i === 7 ? html`<div class="ui-nav__sep"></div>` : ''}
        <button class="ui-nav__item ${act === n.id ? 'is-on' : ''}" data-click="nav" data-id="${n.id}" data-tip="${n.label}${n.key ? ` (${n.key})` : ''}" aria-current="${act === n.id ? 'page' : 'false'}">
          ${raw(icon(n.icon))}<span>${n.label}</span>${badges[n.id] || (n.key ? html`<kbd class="ui-kbd">${n.key}</kbd>` : '')}
        </button>`)}
    </div>
    <div class="ui-side__foot">
      <div class="ui-side__company"><span class="ui-side__swatch"></span><div style="min-width:0"><b>${s.company.name}</b>Founded ${calSafe(s.company.foundedDay || 0).label}</div></div>
    </div>
  `.s;
  // strip tooltips from the wide sidebar (labels are visible); keep them for the icon rail
  if (window.innerWidth > 1180) sideEl.querySelectorAll('[data-tip]').forEach((e) => e.removeAttribute('data-tip'));

  const moreOn = MORE.includes(act);
  const moreDot = lvl.skillPoints > 0;
  tabsEl.innerHTML = html`
    ${TABS.map((id) => {
      const n = NAV.find((x) => x.id === id)!;
      return html`<button class="ui-tabs__item ${act === id ? 'is-on' : ''}" data-click="nav" data-id="${id}">${raw(icon(n.icon))}<span>${n.label}</span>${id === 'hub' && due > 0 ? html`<span class="ui-dot"></span>` : ''}</button>`;
    })}
    <button class="ui-tabs__item ${moreOn ? 'is-on' : ''}" data-click="more">${raw(icon('menu'))}<span>More</span>${moreDot ? html`<span class="ui-dot"></span>` : ''}</button>
  `.s;

  renderTop(lvl);
}

function ownerJobsDue(): number {
  if (!store.loaded) return 0;
  const s = store.state;
  const t = safe(() => sim.jobsToday(s), []);
  return t.filter((j) => !j.done && j.assignee === 'owner').length;
}

function renderTop(lvl: { level: number; progress: number; skillPoints: number; xp: number; xpForNext: number; xpIntoLevel: number }): void {
  const s = store.state;
  const cal = calSafe(s.day);
  const rep = safe(() => sim.reputation(s), 3);
  const left = safe(() => sim.ownerMinutesLeft(s), Math.max(0, 1170 - s.owner.minute));
  const wx = s.weather?.today || 'sunny';
  const active = s.clients.filter((c) => c.status === 'active').length;
  const dayFrac = clamp(left / 720, 0, 1);
  const late = left < 120;
  topEl.innerHTML = html`
    <div class="ui-top__company"><span class="ui-side__swatch" style="width:18px;height:18px;border-radius:6px"></span><b>${s.company.name}</b></div>
    <div class="ui-top__group">
      <button class="ui-pill ui-hide-sm" data-click="calendar" aria-label="Calendar">
        ${raw(icon('calendar'))}
        <span class="ui-pill__stack"><small>${WEEKDAYS_LONG[cal.weekday] || cal.weekdayName}</small><b>${cal.label}</b></span>
      </button>
      <button class="ui-pill ui-weather-btn" data-click="weather" aria-label="Weather: ${WEATHER_LABEL[wx]}. Tap for forecast.">
        ${raw(weatherIcon(wx))}
        <span class="ui-pill__stack ui-hide-sm"><small>Today</small><b>${WEATHER_LABEL[wx]}</b></span>
      </button>
      <button class="ui-pill ui-pill--clock ${late ? 'is-late' : ''} ${left <= 0 ? 'is-dark' : ''}" data-click="clock" aria-label="Clock">
        ${raw(icon(left <= 0 ? 'moon' : 'clock'))}
        <span class="ui-pill__stack ui-daylight-stack"><small>${left > 0 ? `${duration(left)} left` : 'Day is over'}</small><b>${clock(s.owner.minute)}</b></span>
        <span class="ui-daylight ui-hide-sm">${bar(dayFrac, { cls: 'ui-bar--thin', color: late ? 'var(--ui-orange)' : 'var(--ui-sky-500)' })}</span>
      </button>
    </div>
    <div class="ui-top__spacer"></div>
    <div class="ui-top__group">
      <button class="ui-pill ui-hide-sm" data-click="go" data-id="clients" aria-label="Clients">
        ${raw(icon('house'))}<span class="ui-pill__stack"><small>Clients</small><b>${active}</b></span>
      </button>
      <button class="ui-pill ui-pill--rep" data-click="go" data-id="business" data-tip="Reputation ${rep.toFixed(2)} of 5" aria-label="Reputation ${rep.toFixed(1)}">
        ${raw(icon('star'))}<b>${rep.toFixed(1)}</b>
      </button>
      <button class="ui-pill ui-pill--cash" data-click="go" data-id="finance" aria-label="Cash">
        ${raw(icon('cash'))}<b class="ui-cash-val ui-num">${money(shownCash ?? s.cash)}</b>
      </button>
      <button class="ui-level" data-click="go" data-id="skills" style="background:none;border:0;padding:0;min-height:44px" data-tip="Level ${lvl.level}: ${Math.round(lvl.xpIntoLevel)} of ${Math.round(lvl.xpForNext)} XP${lvl.skillPoints ? `. ${lvl.skillPoints} skill point${lvl.skillPoints > 1 ? 's' : ''} to spend` : ''}" aria-label="Level ${lvl.level}">
        ${ring(lvl.progress, lvl.level)}${lvl.skillPoints > 0 ? html`<span class="ui-dot"></span>` : ''}
      </button>
    </div>
  `.s;
  // cash roll
  const cashEl = topEl.querySelector<HTMLElement>('.ui-cash-val');
  const pill = topEl.querySelector<HTMLElement>('.ui-pill--cash');
  if (cashEl && pill) {
    const from = shownCash ?? s.cash;
    const to = s.cash;
    if (Math.round(from) !== Math.round(to)) {
      pill.classList.add(to > from ? 'is-up' : 'is-down');
      countUp(cashEl, from, to, (n) => money(Math.round(n)), 900, prefs.reducedMotion);
    }
    shownCash = to;
  }
}

const topHandlers = {
  go: (el: HTMLElement) => navigate(el.dataset.id || 'hub'),
  weather: (el: HTMLElement) => {
    if (popoverOpen()) { closePopover(); return; }
    popover(el, forecastView());
  },
  calendar: (el: HTMLElement) => {
    if (popoverOpen()) { closePopover(); return; }
    const s = store.state;
    const cal = calSafe(s.day);
    popover(el, html`<div style="min-width:220px">
      <div class="ui-strong" style="font-size:16px">${WEEKDAYS_LONG[cal.weekday]}, ${cal.label}</div>
      <div class="ui-muted ui-small" style="margin:4px 0 10px">Day ${cal.dayOfSeason} of ${cal.seasonLength} this season</div>
      ${bar(cal.dayOfSeason / Math.max(1, cal.seasonLength), { color: 'var(--ui-g-500)' })}
      <div class="ui-small ui-muted" style="margin-top:10px">${cal.isWorkday ? 'Workday. Clients expect service Monday to Saturday.' : 'Sunday. Crews are off and clients do not expect service.'}</div>
    </div>`);
  },
  clock: (el: HTMLElement) => {
    if (popoverOpen()) { closePopover(); return; }
    const s = store.state;
    const left = safe(() => sim.ownerMinutesLeft(s), 0);
    popover(el, html`<div style="min-width:220px">
      <div class="ui-strong" style="font-size:16px">${clock(s.owner.minute)}</div>
      <div class="ui-muted ui-small" style="margin:2px 0 10px">${left > 0 ? `${duration(left)} of daylight left. Work ends at 7:30 PM.` : 'Out of daylight. End the day to rest.'}</div>
      ${bar(clamp(1 - left / 720, 0, 1), { color: 'var(--ui-sky-500)' })}
      <div class="ui-row ui-tiny ui-faint" style="justify-content:space-between;margin-top:4px"><span>7:30 AM</span><span>7:30 PM</span></div>
    </div>`);
  },
};

export function forecastView(): Raw {
  const s = store.state;
  const days = [s.weather.today, ...(s.weather.forecast || [])].slice(0, 4);
  return html`<div style="min-width:240px">
    <div class="ui-strong" style="font-size:15px;margin-bottom:8px">Forecast</div>
    <div class="ui-col" style="gap:6px">
      ${days.map((w, i) => {
        const cal = calSafe(s.day + i);
        return html`<div class="ui-row" style="gap:12px;padding:6px 8px;border-radius:12px;${i === 0 ? 'background:var(--ui-g-50)' : ''}">
          <span class="ui-wxbox" style="width:34px;height:34px">${raw(weatherIcon(w))}</span>
          <div class="ui-grow"><div class="ui-strong">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAYS_LONG[cal.weekday]}: ${WEATHER_LABEL[w]}</div>
          <div class="ui-tiny ui-muted">${WEATHER_NOTE[w]}</div></div>
        </div>`;
      })}
    </div>
    ${s.weather.drought ? html`<div class="ui-note ui-note--warn" style="margin-top:10px">${raw(icon('alert'))}Drought: grass grows slower until it rains.</div>` : ''}
    ${s.weather.fuelPrice ? html`<div class="ui-tiny ui-muted" style="margin-top:10px">${raw(icon('fuel'))} Fuel $${s.weather.fuelPrice.toFixed(2)} per gallon</div>` : ''}
  </div>`;
}

function openMoreSheet(): void {
  const act = activeNav();
  const lvl = safe(() => sim.ownerLevel(store.state), null);
  const m = openModal({
    sheet: true,
    body: html`<div class="ui-more-grid">${MORE.map((id) => {
      const n = NAV.find((x) => x.id === id)!;
      return html`<button class="ui-more-item ${act === id ? 'is-on' : ''}" data-click="go" data-id="${id}">${raw(icon(n.icon))}${n.label}${id === 'skills' && lvl && lvl.skillPoints > 0 ? html`<span class="ui-dot"></span>` : ''}</button>`;
    })}</div>`,
    handlers: { go: (el) => { m.close(); navigate(el.dataset.id || 'hub'); } },
  });
}

// ---------------------------------------------------------------- keyboard
function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (fullscreenHost.classList.contains('is-on')) return;
  const t = e.target as HTMLElement;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (modalOpen()) return;
  if (!current) return;
  if (current.onKey && current.onKey(e)) { e.preventDefault(); return; }
  if (current.bare || current.mount) return;
  if (!store.loaded) return;
  const n = NAV.find((x) => x.key === e.key);
  if (n) { e.preventDefault(); navigate(n.id); return; }
  if (e.key === 'Enter' && currentRoute.screen === 'hub' && !(t && (t.tagName === 'BUTTON' || t.tagName === 'A'))) {
    e.preventDefault();
    void endDayFlow();
  }
}

/** Unmount a full-bleed screen (the neighborhood) while the 3D job runs, so only one scene renders. */
export function suspendScreen(): void {
  if (current?.mount) {
    try { current.unmount?.(); } catch (e) { console.error(e); }
    current = null;
    mainEl.innerHTML = '';
  }
}

export function currentScreenId(): string { return currentRoute.screen; }
export function currentParams(): string[] { return currentRoute.params; }
export function appVisible(v: boolean): void {
  appEl.classList.toggle('is-hidden', !v);
}
export function resetCashDisplay(): void { shownCash = null; }
export { parseHash };
