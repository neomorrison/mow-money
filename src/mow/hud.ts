// DOM overlay for the mowing job: client card, clock, live quality, minimap, status, buttons, modals.
import type { MowJobSpec, QualityBreakdown, WeatherKind } from '../core/types';
import { portraitUrl } from '../data/assets';
import { clock as fmtClock, sqft } from '../core/format';
import { HUD_CSS } from './hudStyle';
import type { JoystickView } from './input';

const svg = (body: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICON = {
  mower: svg('<path d="M3 15h13l3-5"/><path d="M19 10l2-6"/><circle cx="6" cy="18" r="2"/><circle cx="14" cy="18" r="2"/><path d="M5 15V12h7v3"/>'),
  trimmer: svg('<path d="M20 3L7 17"/><path d="M5 19a2 2 0 1 0 3-3"/><path d="M3 21l2-2"/><path d="M15 6l3 3"/>'),
  blower: svg('<path d="M4 10h9a3 3 0 0 1 0 6H9"/><path d="M13 10l6-4v14l-6-4"/><path d="M3 14h3"/><path d="M2 18h5"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  camera: svg('<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>'),
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  bag: svg('<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
};
const WEATHER_ICON: Record<WeatherKind, string> = {
  sunny: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffc12e"/><g stroke="#e6a100" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>`,
  cloudy: `<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="4" fill="#ffc12e"/><path d="M7 19h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 19z" fill="#dfe7ee" stroke="#9aaab8" stroke-width="1.2"/></svg>`,
  rain: `<svg viewBox="0 0 24 24"><path d="M7 15h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 15z" fill="#c9d3dc" stroke="#8796a4" stroke-width="1.2"/><g stroke="#3b8fd1" stroke-width="2" stroke-linecap="round"><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></g></svg>`,
  storm: `<svg viewBox="0 0 24 24"><path d="M7 14h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 14z" fill="#9aa6b1" stroke="#6b7884" stroke-width="1.2"/><path d="M12 14l-2 4h3l-2 4" stroke="#e6a100" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>`,
  heat: `<svg viewBox="0 0 24 24"><circle cx="12" cy="11" r="5.5" fill="#ff9a3c"/><g stroke="#d9483b" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v2M3 11H1.5M22.5 11H21M5 4l1.4 1.4M19 4l-1.4 1.4"/></g><path d="M5 20c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0" stroke="#d9483b" stroke-width="1.6" fill="none"/></svg>`,
};
const WEATHER_LABEL: Record<WeatherKind, string> = { sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', heat: 'Heat' };

function starSvg(fill: number): string {
  const id = 's' + Math.random().toString(36).slice(2, 8);
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return `<svg viewBox="0 0 24 24"><defs><linearGradient id="${id}"><stop offset="${pct}%" stop-color="#ffc12e"/><stop offset="${pct}%" stop-color="#e3d9c0"/></linearGradient></defs><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="url(#${id})" stroke="#c98a00" stroke-width="1" stroke-linejoin="round"/></svg>`;
}

export interface HudHandlers {
  start(): void;
  resume(): void;
  leave(): void;
  finish(): void;           // the Finish button (the job decides whether to confirm)
  finishConfirmed(): void;
  tool(n: 1 | 2 | 3): void;
  deck(d: -1 | 1): void;
  camera(): void;
  missed(): void;
  pause(): void;
  emptyBag(): void;
}

export interface HudState {
  minute: number;
  late: boolean;
  quality: QualityBreakdown | null;
  coverage: number;
  trim: number;
  stripe: number;
  cleanup: number;
  tool: 1 | 2 | 3;
  toolName: string;
  deckIn: number;
  targetIn: number;
  bag: number | null;       // 0..1, null when not bagging
  sharp: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export class Hud {
  root: HTMLDivElement;
  ui: HTMLDivElement;
  minimap: HTMLCanvasElement;
  joy: JoystickView;
  private style: HTMLStyleElement;
  private q = { big: el('div', 'big mmj-disp', '--'), stars: el('div', 'mmj-stars'), bars: el('div', 'mmj-bars') };
  private barEls: Record<string, { fill: HTMLElement; txt: HTMLElement }> = {};
  private clockT = el('div', 't');
  private clockBox: HTMLDivElement;
  private status = { tool: el('div', 'tool'), deck: el('b'), target: el('b'), bagRow: el('div'), bag: el('div', 'mmj-meter'), sharp: el('div', 'mmj-meter') };
  private toolBtns: HTMLButtonElement[] = [];
  private toasts = el('div', 'mmj-toasts');
  private hint = el('div', 'mmj-card mmj-hint');
  private prompt = el('div', 'mmj-card mmj-prompt');
  private modal = el('div', 'mmj-modal');
  private loading = el('div', 'mmj-loading', 'Setting up the job');
  private flashEl = el('div', 'mmj-flash');
  private last: Partial<Record<string, string>> = {};
  private joyEl = el('div', 'mmj-joy', '<i></i>');
  touch: boolean;

  constructor(host: HTMLElement, private spec: MowJobSpec, private h: HudHandlers, touch: boolean, lawnM2: number) {
    this.touch = touch;
    this.style = document.createElement('style');
    this.style.textContent = HUD_CSS;
    this.root = el('div', 'mmj' + (touch ? ' touch' : ''));
    this.root.appendChild(this.style);
    this.ui = el('div', 'mmj-ui');

    // client card
    const client = el('div', 'mmj-card mmj-client');
    const av = el('div', 'mmj-av', esc(initials(spec.ownerName || 'Practice')));
    if (spec.portrait) {
      const img = new Image();
      img.alt = '';
      img.onload = () => { av.innerHTML = ''; av.appendChild(img); };
      img.src = portraitUrl(spec.portrait);
    }
    const who = el('div');
    who.innerHTML = `<b>${esc(spec.ownerName || 'Practice lawn')}</b><span>${esc(spec.address)}</span>`;
    client.append(av, who);

    // clock
    this.clockBox = el('div', 'mmj-card mmj-clock');
    const wIcon = el('div', '', WEATHER_ICON[spec.weather] ?? WEATHER_ICON.sunny);
    const cwrap = el('div');
    cwrap.append(this.clockT, el('div', 'w', WEATHER_LABEL[spec.weather] ?? ''));
    this.clockBox.append(wIcon, cwrap);

    // quality card
    const qc = el('div', 'mmj-card mmj-q');
    const row = el('div', 'row');
    const left = el('div');
    left.append(el('div', 'lbl', 'Quality'), this.q.big);
    row.append(left, this.q.stars);
    qc.append(row, this.q.bars);
    for (const [key, label] of [['cov', 'Coverage'], ['trim', 'Edges'], ['stripe', 'Stripes'], ['clean', 'Cleanup']] as const) {
      const b = el('div', 'mmj-bar');
      const fill = el('u'); const bar = el('i'); bar.appendChild(fill);
      const txt = el('em', '', '0%');
      b.append(el('span', '', label), bar, txt);
      this.q.bars.appendChild(b);
      this.barEls[key] = { fill, txt };
    }
    this.q.stars.innerHTML = [0, 0, 0, 0, 0].map(() => starSvg(0)).join('');

    // minimap
    const mm = el('div', 'mmj-card mmj-mini');
    this.minimap = document.createElement('canvas');
    mm.appendChild(this.minimap);

    // status
    const st = el('div', 'mmj-card mmj-status');
    const kvDeck = el('div', 'kv'); kvDeck.append(el('span', '', 'Deck'), this.status.deck);
    const kvTarget = el('div', 'kv'); kvTarget.append(el('span', '', 'Client wants'), this.status.target);
    this.status.bagRow.append(el('div', 'kv', '<span>Bag</span>'), this.status.bag);
    this.status.bag.innerHTML = '<u style="width:0%"></u>';
    this.status.sharp.innerHTML = '<u style="width:100%"></u>';
    const sharpRow = el('div'); sharpRow.append(el('div', 'kv', '<span>Blade</span>'), this.status.sharp);
    st.append(this.status.tool, kvDeck, kvTarget, this.status.bagRow, sharpRow);

    // buttons
    const btns = el('div', 'mmj-btns');
    const mk = (html: string, cls: string, fn: () => void, title: string) => {
      const b = el('button', 'mmj-b ' + cls, html) as HTMLButtonElement;
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.preventDefault(); fn(); (b as HTMLButtonElement).blur(); });
      return b;
    };
    const k = (s: string) => (touch ? '' : `<span class="k">${s}</span>`);
    const r1 = el('div', 'mmj-btnrow');
    r1.append(
      mk(ICON.eye + k('H'), 'sm', () => h.missed(), 'Show missed spots'),
      mk(ICON.camera + k('V'), 'sm', () => h.camera(), 'Camera'),
      mk(ICON.pause + k('Esc'), 'sm', () => h.pause(), 'Pause'),
    );
    const r2 = el('div', 'mmj-btnrow');
    this.toolBtns = [
      mk(ICON.mower + k('1'), '', () => h.tool(1), 'Mower'),
      mk(ICON.trimmer + k('2'), '', () => h.tool(2), 'Trimmer'),
      mk(ICON.blower + k('3'), '', () => h.tool(3), 'Blower'),
    ];
    if (!spec.trimmer) this.toolBtns[1].disabled = true;
    if (!spec.blower) this.toolBtns[2].disabled = true;
    r2.append(...this.toolBtns);
    const r3 = el('div', 'mmj-btnrow');
    r3.append(
      mk(ICON.down + k('Q'), '', () => h.deck(-1), 'Lower the deck'),
      mk(ICON.up + k('E'), '', () => h.deck(1), 'Raise the deck'),
      mk(ICON.flag + '<span>Finish</span>' + k('F'), 'go', () => h.finish(), 'Finish'),
    );
    btns.append(r1, r2, r3);

    this.prompt.innerHTML = `${ICON.bag}<span>Empty the bag</span>`;
    this.prompt.addEventListener('click', () => h.emptyBag());
    this.prompt.style.cursor = 'pointer';

    const joyHint = el('div', 'mmj-joyhint', 'Drag here to drive');
    this.ui.append(client, this.clockBox, qc, mm, st, btns, this.toasts, this.hint, this.prompt, joyHint);
    this.root.append(this.ui, this.joyEl, this.flashEl, this.modal, this.loading);
    if (spec.weather === 'heat') this.root.insertBefore(el('div', 'mmj-heat'), this.ui);
    host.appendChild(this.root);

    const joyKnob = this.joyEl.firstElementChild as HTMLElement;
    this.joy = {
      show: (x, y) => { this.joyEl.style.display = 'block'; this.joyEl.style.left = x + 'px'; this.joyEl.style.top = y + 'px'; joyKnob.style.transform = ''; joyHint.style.display = 'none'; },
      move: (dx, dy) => { joyKnob.style.transform = `translate(${dx}px,${dy}px)`; },
      hide: () => { this.joyEl.style.display = 'none'; },
    };
    this.layout();
    this.lawnM2 = lawnM2;
  }
  private lawnM2: number;

  /** Switch to the compact layout on small screens. */
  layout() {
    const w = this.root.clientWidth || window.innerWidth, hgt = this.root.clientHeight || window.innerHeight;
    this.root.classList.toggle('compact', w < 760 || hgt < 520);
    this.root.classList.toggle('short', hgt < 480);
  }

  hideLoading() { this.loading.classList.add('gone'); }

  flash() {
    this.flashEl.style.opacity = '0.55';
    setTimeout(() => { this.flashEl.style.opacity = '0'; }, 90);
  }

  update(s: HudState) {
    const set = (key: string, v: string, fn: (v: string) => void) => { if (this.last[key] !== v) { this.last[key] = v; fn(v); } };
    set('clock', fmtClock(s.minute), (v) => { this.clockT.textContent = v; });
    set('late', s.late ? '1' : '0', (v) => this.clockBox.classList.toggle('late', v === '1'));
    if (s.quality) {
      const q = Math.round(s.quality.q);
      set('q', String(q), (v) => { this.q.big.textContent = v; });
      const st = Math.round(s.quality.stars * 4) / 4;
      set('stars', String(st), () => { this.q.stars.innerHTML = [0, 1, 2, 3, 4].map((i) => starSvg(st - i)).join(''); });
    }
    const bar = (key: string, v: number) => set('bar' + key, String(Math.round(v * 100)), (t) => {
      this.barEls[key].fill.style.width = t + '%';
      this.barEls[key].txt.textContent = t + '%';
    });
    bar('cov', s.coverage); bar('trim', s.trim); bar('stripe', s.stripe); bar('clean', s.cleanup);
    set('tool', `${s.tool}|${s.toolName}`, () => {
      const icon = s.tool === 1 ? ICON.mower : s.tool === 2 ? ICON.trimmer : ICON.blower;
      this.status.tool.innerHTML = `${icon}<span>${esc(s.toolName)}</span>`;
      this.toolBtns.forEach((b, i) => b.classList.toggle('on', i + 1 === s.tool));
    });
    set('deck', s.deckIn.toFixed(2) + '|' + s.targetIn, () => {
      this.status.deck.textContent = `${fmtIn(s.deckIn)}`;
      const off = Math.abs(s.deckIn - s.targetIn) > 0.5;
      this.status.deck.className = off ? 'warn' : 'ok';
      this.status.target.textContent = fmtIn(s.targetIn);
    });
    set('bag', s.bag === null ? 'x' : String(Math.round(s.bag * 50)), () => {
      this.status.bagRow.style.display = s.bag === null ? 'none' : '';
      if (s.bag !== null) {
        (this.status.bag.firstElementChild as HTMLElement).style.width = Math.round(s.bag * 100) + '%';
        this.status.bag.classList.toggle('full', s.bag >= 0.999);
      }
    });
    set('sharp', String(Math.round(s.sharp * 50)), () => {
      (this.status.sharp.firstElementChild as HTMLElement).style.width = Math.round(s.sharp * 100) + '%';
    });
  }

  toast(text: string, tone: '' | 'bad' | 'good' | 'warn' = '') {
    const t = el('div', 'mmj-toast ' + tone, esc(text));
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.remove(), 3000);
  }

  setHint(text: string | null, label = 'Tip') {
    const key = text ?? '';
    if (this.last.hint === key) return;
    this.last.hint = key;
    if (!text) { this.hint.classList.remove('show'); return; }
    this.hint.innerHTML = `<small>${esc(label)}</small>${esc(text)}`;
    this.hint.classList.remove('show');
    void this.hint.offsetWidth;
    this.hint.classList.add('show');
  }

  setBagPrompt(show: boolean) {
    const key = show ? '1' : '0';
    if (this.last.prompt === key) return;
    this.last.prompt = key;
    this.prompt.innerHTML = `${ICON.bag}<span>Empty the bag${this.touch ? '' : ' <kbd style="font:inherit;background:#f3e6c8;border-radius:6px;padding:0 6px">E</kbd>'}</span>`;
    this.prompt.classList.toggle('show', show);
  }

  // ---------------------------------------------------------------- modals
  private openModal(content: HTMLElement) {
    this.modal.innerHTML = '';
    this.modal.appendChild(content);
    this.modal.classList.add('show');
  }
  closeModal() { this.modal.classList.remove('show'); this.modal.innerHTML = ''; }
  get modalOpen() { return this.modal.classList.contains('show'); }

  private button(label: string, cls: string, fn: () => void): HTMLButtonElement {
    const b = el('button', 'mmj-b ' + cls, label) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  controlsHtml(): string {
    if (this.touch) {
      return `<div class="mmj-keys">
        <span><kbd>Left thumb</kbd></span><span>Drag anywhere on the left side to drive</span>
        <span><kbd>Right side</kbd></span><span>Drag to look around, pinch to zoom</span>
        <span><kbd>Tools</kbd></span><span>Mower, trimmer, blower buttons</span>
        <span><kbd>Deck</kbd></span><span>Lower or raise the cutting height</span>
        <span><kbd>Eye</kbd></span><span>Flash the spots you missed</span></div>`;
    }
    return `<div class="mmj-keys">
      <span><kbd>W A S D</kbd> <kbd>Arrows</kbd></span><span>Drive and steer</span>
      <span><kbd>Shift</kbd></span><span>Slow, precise driving</span>
      <span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></span><span>Mower, trimmer, blower</span>
      <span><kbd>Q</kbd> <kbd>E</kbd></span><span>Lower or raise the deck</span>
      <span><kbd>E</kbd> at your vehicle</span><span>Empty the bag</span>
      <span><kbd>H</kbd></span><span>Flash missed spots</span>
      <span><kbd>V</kbd> and mouse drag</span><span>Camera view and orbit, wheel to zoom</span>
      <span><kbd>F</kbd> <kbd>Esc</kbd></span><span>Finish, pause</span></div>`;
  }

  showStart(extra: { mowerName: string; tutorial: boolean }) {
    const s = this.spec;
    const sheet = el('div', 'mmj-sheet');
    const facts: [string, string][] = [
      ['Lawn', sqft(this.lawnM2)],
      ['Grass', `${fmtIn(s.grassIn)}`],
      ['Cut to', `${fmtIn(s.targetIn)}`],
      ['Weather', WEATHER_LABEL[s.weather] + (s.wet ? ', wet' : '')],
      ['Stripes', `${s.autoStripe ? 'Auto, ' : ''}${s.wantsStripes ? 'big bonus' : 'bonus'}`],
      ['Mower', extra.mowerName],
    ];
    const notes = [...s.notes];
    if (s.kind === 'leaves' || s.leaves > 0.05) notes.push('Leaves are down. Mulch them with the mower and clear the drive.');
    if (s.autoStripe) notes.push('Striping roller on: stripes lay themselves wherever you mow.');
    else if (s.wantsStripes) notes.push('Straight back-and-forth passes along the lane guides earn a stripe bonus.');
    sheet.innerHTML = `
      <h2>${esc(s.address)}</h2>
      <div class="mmj-sub">${esc(s.ownerName ? s.ownerName : 'Practice lawn')}${s.tutorial ? ' · First job' : ''}</div>
      <div class="mmj-facts">${facts.map(([a, b]) => `<div class="mmj-fact"><small>${esc(a)}</small><b>${esc(b)}</b></div>`).join('')}</div>
      ${notes.length ? `<h3>Client notes</h3><ul class="mmj-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <h3>Controls</h3>${this.controlsHtml()}`;
    const act = el('div', 'mmj-actions');
    act.appendChild(this.button('Start', 'go big', () => { this.closeModal(); this.h.start(); }));
    sheet.appendChild(act);
    this.openModal(sheet);
    (act.firstElementChild as HTMLElement)?.focus();
  }

  showPause() {
    const sheet = el('div', 'mmj-sheet');
    sheet.style.width = 'min(400px,100%)';
    sheet.innerHTML = `<h2>Paused</h2><div class="mmj-sub">${esc(this.spec.address)}</div>`;
    const menu = el('div', 'mmj-menu');
    const controls = el('div');
    controls.style.display = 'none';
    controls.style.marginTop = '14px';
    controls.innerHTML = this.controlsHtml();
    menu.append(
      this.button('Resume', 'go', () => { this.closeModal(); this.h.resume(); }),
      this.button('Controls', '', () => { controls.style.display = controls.style.display === 'none' ? 'block' : 'none'; }),
      this.button('Leave job', '', () => this.confirmLeave()),
    );
    sheet.append(menu, controls);
    this.openModal(sheet);
  }

  private confirmLeave() {
    const sheet = el('div', 'mmj-sheet');
    sheet.style.width = 'min(420px,100%)';
    sheet.innerHTML = `<h2>Leave the job?</h2><p>${this.spec.clientId ? 'No pay for an unfinished lawn. The time spent still counts.' : 'Your progress on this lawn is lost.'}</p>`;
    const act = el('div', 'mmj-actions');
    act.append(this.button('Stay', '', () => this.showPause()), this.button('Leave', 'mmj-yellow', () => { this.closeModal(); this.h.leave(); }));
    sheet.appendChild(act);
    this.openModal(sheet);
  }

  confirmFinish(coverage: number) {
    const sheet = el('div', 'mmj-sheet');
    sheet.style.width = 'min(440px,100%)';
    sheet.innerHTML = `<h2>Finish now?</h2><p>Coverage is ${Math.round(coverage * 100)}%. Missed patches are the first thing clients notice.</p>`;
    const act = el('div', 'mmj-actions');
    act.append(this.button('Keep mowing', 'go', () => { this.closeModal(); this.h.resume(); }), this.button('Finish', 'mmj-yellow', () => { this.closeModal(); this.h.finishConfirmed(); }));
    sheet.appendChild(act);
    this.openModal(sheet);
  }

  notice(title: string, text: string, button: string, fn: () => void) {
    const sheet = el('div', 'mmj-sheet');
    sheet.style.width = 'min(420px,100%)';
    sheet.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p>`;
    const act = el('div', 'mmj-actions');
    act.append(this.button(button, 'go big', () => { this.closeModal(); fn(); }));
    sheet.appendChild(act);
    this.openModal(sheet);
  }

  dispose() { this.root.remove(); }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}
function fmtIn(x: number): string {
  return `${Number.isInteger(x * 2) ? x.toFixed(1) : x.toFixed(2)} in`;
}
