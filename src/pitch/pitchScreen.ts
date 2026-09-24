// The negotiation overlay: the homeowner framed in their open front door, the conversation as speech
// bubbles, and a stage-based choice panel (opener, talking points, offer, end card).
// Works with mouse, touch and keyboard (1-6 choose, Enter offers or confirms, Esc walks away).
import type { AddOn, Frequency, PitchContext, PitchOutcome, Tone } from '../core/types';
import { ARCHETYPE_BY_ID } from '../data/archetypes';
import { audio } from '../audio';
import { money } from '../core/format';
import { loadSettings } from '../core/save';
import {
  ADDONS, ADDON_LABEL, ADDON_PCT, TONES, TONE_LABEL, availablePoints, createNegotiation, fairHint, offerTotal,
  previewBucket, previewOpener, previewPoint, step, type Mood, type NegotiationState, type PitchAction, type StepResult,
} from '../sim/negotiation';
import { esc, el, moodFace, portrait, MOOD_LABEL, PREVIEW_LABEL } from './avatar';
import { ensurePitchStyles } from './styles';

export interface PitchScreenOptions {
  ctx: PitchContext;
  seed: number;
  companyColor?: string;
  /** Called once when the player closes the end card. */
  onClose(outcome: PitchOutcome): void;
}

type UiStage = 'opener' | 'points' | 'offer' | 'end';

const TONE_HINT: Record<string, string> = {
  friendly: 'Warm and chatty',
  professional: 'Polished and businesslike',
  direct: 'Short and to the point',
  funny: 'Break the ice',
};

export class PitchScreen {
  readonly root: HTMLElement;
  private n: NegotiationState;
  private ui: UiStage = 'opener';
  private busy = false;
  private price: number;
  private freq: Frequency;
  private addOns = new Set<AddOn>();
  private counter: number | null = null;
  private finalOffer = false;
  private reduced: boolean;
  private timers: number[] = [];
  private closed = false;
  private els: {
    face: HTMLElement; moodLabel: HTMLElement; pips: HTMLElement; warmth: HTMLElement; log: HTMLElement; panel: HTMLElement;
    door: HTMLElement; status: HTMLElement;
  };
  private onKey = (e: KeyboardEvent) => this.key(e);

  constructor(host: HTMLElement, private opts: PitchScreenOptions) {
    ensurePitchStyles();
    this.reduced = loadSettings().reducedMotion;
    this.n = createNegotiation(opts.ctx, opts.seed);
    const arch = ARCHETYPE_BY_ID[opts.ctx.house.archetypeId];
    this.freq = arch?.prefersFreq ?? 7;
    this.price = fairHint(opts.ctx, this.freq);
    const info = opts.ctx.house;

    this.root = el('div', 'pitch-overlay');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', `Pitch at ${info.address}`);
    if (opts.companyColor) this.root.style.setProperty('--co', opts.companyColor);
    this.root.innerHTML = `
      <div class="pitch-dialog">
        <section class="pitch-doorside">
          <div class="pitch-doorframe">
            <div class="pitch-porchlight" aria-hidden="true"></div>
            <div class="pitch-housenum" aria-hidden="true">${esc(info.number)}</div>
            <div class="pitch-doorway">
              <div class="pitch-doorway-inner"></div>
              <div class="pitch-door-leaf" aria-hidden="true"><span class="pitch-knob"></span><span class="pitch-panel p1"></span><span class="pitch-panel p2"></span></div>
            </div>
            <div class="pitch-mat" aria-hidden="true">WELCOME</div>
          </div>
          <div class="pitch-who">
            <div class="pitch-name">${esc(info.ownerName)}</div>
            <div class="pitch-arch">${esc(arch?.label ?? 'Homeowner')}</div>
            <div class="pitch-flavor">${esc(arch?.flavor ?? '')}</div>
          </div>
          <div class="pitch-moodrow">
            <div class="pitch-facewrap"></div>
            <div class="pitch-moodinfo">
              <div class="pitch-moodlabel"></div>
              <div class="pitch-meter" title="Warmth"><span class="pitch-meter-fill"></span></div>
              <div class="pitch-pips" aria-label="Patience"></div>
            </div>
          </div>
          <ul class="pitch-notes" aria-label="What you know">${this.notes()}</ul>
        </section>
        <section class="pitch-talkside">
          <header class="pitch-talkhead">
            <div>
              <div class="pitch-address">${esc(info.address)}</div>
              <div class="pitch-sub">${esc(Math.round(info.lawnSqft).toLocaleString('en-US'))} sq ft lawn, grass ${opts.ctx.grassIn.toFixed(1)} in</div>
            </div>
            <div class="pitch-status" aria-live="polite"></div>
          </header>
          <div class="pitch-log" role="log" aria-live="polite"></div>
          <div class="pitch-panel-wrap"></div>
        </section>
      </div>`;
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    this.els = {
      face: q('.pitch-facewrap'), moodLabel: q('.pitch-moodlabel'), pips: q('.pitch-pips'),
      warmth: q('.pitch-meter-fill'), log: q('.pitch-log'), panel: q('.pitch-panel-wrap'), door: q('.pitch-doorframe'),
      status: q('.pitch-status'),
    };
    q('.pitch-doorway-inner').appendChild(portrait(info.portrait, info.ownerName, { cls: 'pitch-portrait-xl', bust: true }));
    host.appendChild(this.root);
    document.addEventListener('keydown', this.onKey);

    // Door swings open, then the greeting.
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.renderMood();
    this.renderPanel();
    this.later(this.reduced ? 0 : 420, () => {
      for (const l of this.n.log) this.bubble(l.who, l.text);
    });
  }

  // ---------------------------------------------------------------- rendering
  private notes(): string {
    const c = this.opts.ctx;
    const out: string[] = [];
    const tall = c.grassIn > 5.5;
    out.push(`<li class="${tall ? 'is-good' : c.grassIn < 4 ? 'is-bad' : ''}">Grass at ${c.grassIn.toFixed(1)} in${tall ? ', overgrown' : c.grassIn < 4 ? ', freshly cut' : ''}</li>`);
    out.push(`<li>${c.provider === 'rival' && c.rival ? `Uses ${esc(c.rival.name)}` : c.provider === 'diy' ? 'Mows it themselves' : 'No lawn service'}</li>`);
    if (c.warmTrust > 0) out.push('<li class="is-good">Warm lead</li>');
    if (c.hoa) out.push('<li class="is-good">Got an HOA letter</li>');
    if (c.clientsOnStreet > 0) out.push(`<li class="is-good">${c.clientsOnStreet} ${c.clientsOnStreet === 1 ? 'client' : 'clients'} on ${esc(c.house.street)}</li>`);
    out.push(`<li>Going rate ${money(fairHint(c, 7))} weekly</li>`);
    return out.join('');
  }

  private renderMood(): void {
    const n = this.n;
    this.els.face.innerHTML = moodFace(n.mood, n.trust);
    this.els.moodLabel.textContent = MOOD_LABEL[n.mood];
    this.els.warmth.style.width = `${Math.round(n.trust * 100)}%`;
    const pips: string[] = [];
    for (let i = 0; i < n.patienceMax; i++) pips.push(`<span class="pitch-pip${i < n.patience ? ' is-on' : ''}"></span>`);
    this.els.pips.innerHTML = `<span class="pitch-pips-label">Patience</span>${pips.join('')}`;
    this.els.pips.setAttribute('aria-label', `Patience ${Math.max(0, n.patience)} of ${n.patienceMax}`);
    this.root.dataset.mood = n.mood;
  }

  private bubble(who: 'you' | 'them', text: string): HTMLElement {
    const b = el('div', `pitch-bubble pitch-bubble-${who}`);
    b.innerHTML = `<span class="pitch-bubble-who">${who === 'you' ? 'You' : esc(this.opts.ctx.house.ownerName.split(' ')[0])}</span><span class="pitch-bubble-text">${esc(text)}</span>`;
    this.els.log.appendChild(b);
    this.els.log.scrollTop = this.els.log.scrollHeight;
    return b;
  }

  private typing(): HTMLElement {
    const b = el('div', 'pitch-bubble pitch-bubble-them pitch-typing', '<span></span><span></span><span></span>');
    b.setAttribute('aria-hidden', 'true');
    this.els.log.appendChild(b);
    this.els.log.scrollTop = this.els.log.scrollHeight;
    return b;
  }

  private renderPanel(): void {
    const p = this.els.panel;
    const n = this.n;
    this.els.status.innerHTML = this.counter !== null && this.ui !== 'end'
      ? `<span class="pitch-chip pitch-chip-counter">${this.finalOffer ? 'Final offer' : 'Their offer'} ${money(this.counter)}</span>`
      : '';
    if (this.ui === 'opener') {
      p.innerHTML = `
        <div class="pitch-panel-title">Open with</div>
        <div class="pitch-choices pitch-choices-4">
          ${TONES.map((t, i) => `
            <button class="pitch-choice" data-tone="${t}" type="button">
              <span class="pitch-key">${i + 1}</span>
              <span class="pitch-choice-label">${TONE_LABEL[t]}</span>
              <span class="pitch-choice-hint">${TONE_HINT[t]}</span>
              <span class="pitch-choice-line">"${esc(previewOpener(n, t))}"</span>
            </button>`).join('')}
        </div>
        <div class="pitch-actions"><button class="pitch-btn pitch-btn-ghost" data-act="leave" type="button">Walk away <kbd>Esc</kbd></button></div>`;
    } else if (this.ui === 'points') {
      const pts = availablePoints(n);
      const left = 2 - n.pointsUsed.length;
      let k = 0;
      p.innerHTML = `
        <div class="pitch-panel-title">Make your case <span class="pitch-panel-note">${left > 0 ? `Up to ${left} more` : 'Two points made'}</span></div>
        <div class="pitch-choices pitch-choices-6">
          ${pts.map((pt) => {
            const hot = pt.enabled ? ++k : 0;
            return `
            <button class="pitch-choice pitch-point${pt.enabled ? '' : ' is-disabled'}" data-point="${pt.id}" type="button" ${pt.enabled ? `data-hot="${hot}"` : 'aria-disabled="true"'}>
              ${pt.enabled ? `<span class="pitch-key">${hot}</span>` : ''}
              <span class="pitch-choice-label">${esc(pt.label)}</span>
              <span class="pitch-choice-hint">${esc(pt.enabled ? pt.hint : pt.reason)}</span>
              ${pt.enabled ? `<span class="pitch-choice-line">"${esc(previewPoint(n, pt.id))}"</span>` : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="pitch-actions">
          <button class="pitch-btn pitch-btn-ghost" data-act="leave" type="button">Walk away <kbd>Esc</kbd></button>
          <button class="pitch-btn pitch-btn-go" data-act="to-offer" type="button">Talk price <kbd>Enter</kbd></button>
        </div>`;
    } else if (this.ui === 'offer') {
      this.renderOffer();
    } else {
      this.renderEnd();
    }
    this.bindPanel();
  }

  private renderOffer(): void {
    const n = this.n;
    const ctx = this.opts.ctx;
    const fair = fairHint(ctx, this.freq);
    const lo = Math.max(5, Math.round(fair * 0.5));
    const hi = Math.max(lo + 10, Math.round(fair * 2.2));
    const addOns = [...this.addOns];
    const total = offerTotal(this.price, addOns);
    const room = ctx.perks.includes('read_the_room');
    const bucket = room ? previewBucket(n, this.price, this.freq, addOns) : null;
    const canBack = n.stage === 'points' && n.pointsUsed.length < 2;
    this.els.panel.innerHTML = `
      <div class="pitch-panel-title">Your offer <span class="pitch-panel-note">Going rate ${money(fair)} per mow</span></div>
      <div class="pitch-offer">
        <div class="pitch-freq" role="radiogroup" aria-label="Frequency">
          <button type="button" role="radio" class="pitch-seg${this.freq === 7 ? ' is-on' : ''}" aria-checked="${this.freq === 7}" data-freq="7">Weekly</button>
          <button type="button" role="radio" class="pitch-seg${this.freq === 14 ? ' is-on' : ''}" aria-checked="${this.freq === 14}" data-freq="14">Every 2 weeks</button>
        </div>
        <div class="pitch-stepper" aria-label="Price per mow">
          <button type="button" class="pitch-step" data-d="-5" aria-label="Minus 5 dollars">-5</button>
          <button type="button" class="pitch-step" data-d="-1" aria-label="Minus 1 dollar">-1</button>
          <div class="pitch-price"><span class="pitch-price-val">${money(this.price)}</span><span class="pitch-price-unit">base per mow</span></div>
          <button type="button" class="pitch-step" data-d="1" aria-label="Plus 1 dollar">+1</button>
          <button type="button" class="pitch-step" data-d="5" aria-label="Plus 5 dollars">+5</button>
        </div>
        <input class="pitch-slider" type="range" min="${lo}" max="${hi}" step="1" value="${Math.min(hi, Math.max(lo, this.price))}" aria-label="Price per mow" />
        <div class="pitch-addons">
          ${ADDONS.map((a) => `
            <label class="pitch-addon${this.addOns.has(a) ? ' is-on' : ''}">
              <input type="checkbox" data-addon="${a}" ${this.addOns.has(a) ? 'checked' : ''} />
              <span class="pitch-addon-box" aria-hidden="true"></span>
              <span>${ADDON_LABEL[a]}</span><span class="pitch-addon-pct">+${Math.round(ADDON_PCT[a] * 100)}%</span>
            </label>`).join('')}
        </div>
        <div class="pitch-total">
          <span>Total <strong>${money(total)}</strong> per mow, ${this.freq === 7 ? 'weekly' : 'every 2 weeks'}</span>
          ${bucket ? `<span class="pitch-chip pitch-room pitch-room-${bucket}" title="Read the Room">${PREVIEW_LABEL[bucket]}</span>` : ''}
        </div>
      </div>
      <div class="pitch-actions pitch-actions-offer">
        <button class="pitch-btn pitch-btn-ghost" data-act="leave" type="button">Walk away <kbd>Esc</kbd></button>
        ${canBack ? '<button class="pitch-btn pitch-btn-ghost" data-act="back" type="button">Back</button>' : ''}
        ${n.trialUnlocked ? `<button class="pitch-btn pitch-btn-sun" data-act="trial" type="button">Offer a free first mow <kbd>T</kbd></button>` : ''}
        ${this.counter !== null ? `<button class="pitch-btn pitch-btn-sun" data-act="accept" type="button">Accept ${money(this.counter)} <kbd>A</kbd></button>` : ''}
        <button class="pitch-btn pitch-btn-go" data-act="offer" type="button">Make offer <kbd>Enter</kbd></button>
      </div>`;
  }

  private renderEnd(): void {
    const o = this.n.outcome!;
    const good = o.result === 'deal' || o.result === 'trial';
    const title = { deal: 'Deal', trial: 'Trial booked', cold: 'Not today', rejected: 'Door closed', left: 'You walked away' }[o.result];
    const rows: string[] = [];
    if (good) {
      rows.push(`<div class="pitch-endrow"><span>Price</span><strong>${money(o.price ?? 0)} per mow</strong></div>`);
      rows.push(`<div class="pitch-endrow"><span>Frequency</span><strong>${o.freq === 14 ? 'Every 2 weeks' : 'Weekly'}</strong></div>`);
      if (o.addOns && o.addOns.length) rows.push(`<div class="pitch-endrow"><span>Add-ons</span><strong>${o.addOns.map((a) => ADDON_LABEL[a]).join(', ')}</strong></div>`);
      rows.push(`<div class="pitch-endrow"><span>First mow</span><strong>${o.result === 'trial' ? 'Today, free' : 'Due today'}</strong></div>`);
      if (o.result === 'trial') rows.push(`<div class="pitch-endnote">They sign if the first mow meets their standard.</div>`);
    } else {
      const note = {
        cold: 'They want to think it over. Try again in 5 days.',
        rejected: 'They took that price personally. Try another house.',
        left: 'No hard feelings. You can knock again tomorrow.',
      }[o.result as 'cold' | 'rejected' | 'left'] ?? o.summary;
      rows.push(`<div class="pitch-endnote">${esc(note)}</div>`);
    }
    rows.push(`<div class="pitch-endrow pitch-endrow-dim"><span>Time spent</span><strong>${Math.round(o.minutes)} min</strong></div>`);
    this.els.panel.innerHTML = `
      <div class="pitch-end pitch-end-${good ? 'good' : 'bad'}">
        <div class="pitch-stamp">${title}</div>
        <div class="pitch-endrows">${rows.join('')}</div>
        <div class="pitch-actions"><button class="pitch-btn pitch-btn-go" data-act="done" type="button">Done <kbd>Enter</kbd></button></div>
      </div>`;
    const done = this.els.panel.querySelector<HTMLButtonElement>('[data-act="done"]');
    done?.focus({ preventScroll: true });
  }

  private bindPanel(): void {
    const p = this.els.panel;
    p.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach((b) => b.addEventListener('click', () => this.act({ type: 'opener', tone: b.dataset.tone as Tone })));
    p.querySelectorAll<HTMLButtonElement>('[data-point]').forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('is-disabled')) { b.classList.remove('pitch-shake'); void b.offsetWidth; b.classList.add('pitch-shake'); return; }
      this.act({ type: 'point', id: b.dataset.point! });
    }));
    p.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.command(b.dataset.act!)));
    p.querySelectorAll<HTMLButtonElement>('[data-freq]').forEach((b) => b.addEventListener('click', () => this.setFreq(Number(b.dataset.freq) as Frequency)));
    p.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.addEventListener('click', () => this.nudge(Number(b.dataset.d))));
    const slider = p.querySelector<HTMLInputElement>('.pitch-slider');
    slider?.addEventListener('input', () => { this.price = Number(slider.value); this.refreshOfferNumbers(); });
    p.querySelectorAll<HTMLInputElement>('[data-addon]').forEach((c) => c.addEventListener('change', () => {
      const a = c.dataset.addon as AddOn;
      if (c.checked) this.addOns.add(a); else this.addOns.delete(a);
      audio.play('click', { volume: 0.5 });
      this.renderPanel();
    }));
  }

  /** Update price readouts without rebuilding the panel (keeps the slider under the finger). */
  private refreshOfferNumbers(): void {
    const p = this.els.panel;
    const addOns = [...this.addOns];
    const val = p.querySelector('.pitch-price-val');
    if (val) val.textContent = money(this.price);
    const total = p.querySelector('.pitch-total strong');
    if (total) total.textContent = money(offerTotal(this.price, addOns));
    const room = p.querySelector('.pitch-room');
    if (room) {
      const b = previewBucket(this.n, this.price, this.freq, addOns);
      room.className = `pitch-chip pitch-room pitch-room-${b}`;
      room.textContent = PREVIEW_LABEL[b];
    }
  }

  private nudge(d: number): void {
    this.price = Math.max(1, Math.min(99999, this.price + d));
    audio.play('click', { volume: 0.4 });
    const slider = this.els.panel.querySelector<HTMLInputElement>('.pitch-slider');
    if (slider) slider.value = String(this.price);
    this.refreshOfferNumbers();
  }

  private setFreq(f: Frequency): void {
    if (f === this.freq) return;
    // Keep the price proportional to the going rate when switching.
    const ratio = this.price / fairHint(this.opts.ctx, this.freq);
    this.freq = f;
    this.price = Math.max(1, Math.round(ratio * fairHint(this.opts.ctx, f)));
    audio.play('click', { volume: 0.5 });
    this.renderPanel();
  }

  // ---------------------------------------------------------------- actions
  private command(act: string): void {
    if (this.busy) return;
    switch (act) {
      case 'leave': this.act({ type: 'leave' }); break;
      case 'to-offer': this.ui = 'offer'; audio.play('click', { volume: 0.5 }); this.renderPanel(); this.focusPanel(); break;
      case 'back': this.ui = 'points'; this.renderPanel(); this.focusPanel(); break;
      case 'offer': this.act({ type: 'offer', price: this.price, freq: this.freq, addOns: [...this.addOns] }); break;
      case 'trial': this.act({ type: 'trial', price: this.price, freq: this.freq, addOns: [...this.addOns] }); break;
      case 'accept': this.act({ type: 'accept_counter' }); break;
      case 'done': this.close(); break;
    }
  }

  private act(action: PitchAction): void {
    if (this.busy || this.closed || this.n.done) return;
    const res = step(this.n, action);
    if (!res.lines.length) return;
    this.busy = true;
    this.root.classList.add('is-busy');
    audio.play('click', { volume: 0.5 });
    const mine = res.lines.filter((l) => l.who === 'you');
    const theirs = res.lines.filter((l) => l.who === 'them');
    for (const l of mine) this.bubble('you', l.text);
    const delay = this.reduced ? 0 : 520;
    let t = delay;
    const typingEl = theirs.length && delay ? this.typing() : null;
    theirs.forEach((l, i) => {
      this.later(t, () => {
        if (i === 0) typingEl?.remove();
        this.bubble('them', l.text);
        if (i === 0) this.afterReply(action, res);
      });
      t += this.reduced ? 0 : 650;
    });
    this.later(Math.max(delay, t - (this.reduced ? 0 : 650)) + 40, () => this.settle(action, res));
  }

  /** Mood face and sounds change as soon as they answer. */
  private afterReply(action: PitchAction, res: StepResult): void {
    this.renderMood();
    this.root.classList.remove('pitch-react-good', 'pitch-react-bad');
    void this.root.offsetWidth;
    if (res.effect === 'works' || res.mood === 'accept') this.root.classList.add('pitch-react-good');
    if (res.effect === 'fails' || res.mood === 'offended' || res.mood === 'steep') this.root.classList.add('pitch-react-bad');
    if (res.outcome && (res.outcome.result === 'deal' || res.outcome.result === 'trial')) audio.play('deal');
    else if (res.outcome && res.outcome.result !== 'left') audio.play('reject');
    else if (action.type === 'offer' || action.type === 'trial') audio.play(res.mood === 'offended' ? 'reject' : 'click', { volume: 0.6 });
  }

  private settle(action: PitchAction, res: StepResult): void {
    this.busy = false;
    this.root.classList.remove('is-busy');
    if (res.counter !== null) {
      this.counter = res.counter;
      this.finalOffer = res.finalOffer;
    }
    if (res.done) {
      this.ui = 'end';
      if (res.outcome?.result === 'deal' || res.outcome?.result === 'trial') { this.root.classList.add('is-deal'); this.confetti(); }
      else this.root.classList.add('is-closed');
    } else if (action.type === 'opener') {
      this.ui = 'points';
    } else if (action.type === 'point') {
      this.ui = this.n.pointsUsed.length >= 2 ? 'offer' : 'points';
    } else {
      this.ui = 'offer';
    }
    this.renderMood();
    this.renderPanel();
    this.focusPanel();
    this.els.log.scrollTop = this.els.log.scrollHeight;
  }

  private confetti(): void {
    if (this.reduced) return;
    const box = el('div', 'pitch-confetti');
    box.setAttribute('aria-hidden', 'true');
    const cols = ['#ffcb3d', '#4f9d3a', '#de5a45', '#3b6fb6', '#7cc25a', '#ffffff'];
    let html = '';
    for (let i = 0; i < 36; i++) {
      const left = (i * 37) % 100;
      const delay = ((i * 53) % 40) / 100;
      const dur = 1.3 + ((i * 29) % 50) / 100;
      html += `<i style="left:${left}%;background:${cols[i % cols.length]};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${(i * 47) % 360}deg)"></i>`;
    }
    box.innerHTML = html;
    this.root.querySelector('.pitch-dialog')?.appendChild(box);
    window.setTimeout(() => box.remove(), 2600);
  }

  private focusPanel(): void {
    const b = this.els.panel.querySelector<HTMLElement>('.pitch-btn-go') ?? this.els.panel.querySelector<HTMLElement>('.pitch-choice:not(.is-disabled)');
    b?.focus({ preventScroll: true });
  }

  private key(e: KeyboardEvent): void {
    if (this.closed) return;
    const tgt = e.target as HTMLElement | null;
    const inField = tgt && tgt.tagName === 'INPUT' && (tgt as HTMLInputElement).type !== 'range' && (tgt as HTMLInputElement).type !== 'checkbox';
    if (inField) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.ui === 'end') this.close(); else this.command('leave');
      return;
    }
    if (this.busy) return;
    if (e.key === 'Enter') {
      // A focused action button or choice card clicks itself; anywhere else Enter runs the stage's main action.
      if (tgt && tgt.tagName === 'BUTTON' && this.root.contains(tgt) && (tgt.dataset.act || (this.ui !== 'offer' && tgt.classList.contains('pitch-choice')))) return;
      e.preventDefault();
      if (this.ui === 'points') this.command('to-offer');
      else if (this.ui === 'offer') this.command('offer');
      else if (this.ui === 'end') this.close();
      return;
    }
    const num = Number(e.key);
    if (num >= 1 && num <= 6) {
      if (this.ui === 'opener' && num <= 4) { e.preventDefault(); this.act({ type: 'opener', tone: TONES[num - 1] }); }
      else if (this.ui === 'points') {
        const b = this.els.panel.querySelector<HTMLButtonElement>(`[data-hot="${num}"]`);
        if (b) { e.preventDefault(); this.act({ type: 'point', id: b.dataset.point! }); }
      }
      return;
    }
    if (this.ui === 'offer') {
      const k = e.key.toLowerCase();
      const onSlider = tgt?.tagName === 'INPUT' && (tgt as HTMLInputElement).type === 'range';
      if (!onSlider && (e.key === 'ArrowUp' || e.key === 'ArrowRight')) { e.preventDefault(); this.nudge(e.shiftKey ? 5 : 1); }
      else if (!onSlider && (e.key === 'ArrowDown' || e.key === 'ArrowLeft')) { e.preventDefault(); this.nudge(e.shiftKey ? -5 : -1); }
      else if (k === 'a' && this.counter !== null) { e.preventDefault(); this.command('accept'); }
      else if (k === 't' && this.n.trialUnlocked) { e.preventDefault(); this.command('trial'); }
      else if (k === 'f') { e.preventDefault(); this.setFreq(this.freq === 7 ? 14 : 7); }
    }
  }

  private later(ms: number, fn: () => void): void {
    if (ms <= 0) { fn(); return; }
    this.timers.push(window.setTimeout(() => { if (!this.closed) fn(); }, ms));
  }

  private close(): void {
    if (this.closed) return;
    const outcome = this.n.outcome;
    if (!outcome) return;
    this.closed = true;
    this.root.classList.add('is-leaving');
    const finish = () => { this.dispose(); this.opts.onClose(outcome); };
    if (this.reduced) finish(); else window.setTimeout(finish, 220);
  }

  /** Current negotiation (read only; for tests and harnesses). */
  get state(): NegotiationState { return this.n; }
  get mood(): Mood { return this.n.mood; }

  dispose(): void {
    this.closed = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    document.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}
