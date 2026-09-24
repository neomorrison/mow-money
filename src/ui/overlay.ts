// Toasts, modals, confirm dialogs, drawers, popovers and tooltips.
import { bus } from '../core/bus';
import { audio } from '../audio';
import { html, raw, delegate, type Handlers, type Raw } from './html';
import { icon } from './icons';

let root: HTMLElement;
let toastsEl: HTMLElement;

export function initOverlays(): void {
  root = document.createElement('div');
  root.className = 'ui-overlays';
  document.body.appendChild(root);
  toastsEl = document.createElement('div');
  toastsEl.className = 'ui-toasts';
  toastsEl.setAttribute('role', 'status');
  toastsEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastsEl);
  bus.on('toast', ({ text, kind }) => toast(text, kind));
  initTooltips();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      const top = stack[stack.length - 1];
      if (top.dismissable) { e.preventDefault(); top.close(); }
    }
  });
}

// ---------------------------------------------------------------- toasts
export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  if (!toastsEl || !text) return;
  const ic = kind === 'good' ? 'check' : kind === 'bad' ? 'alert' : 'info';
  const t = document.createElement('div');
  t.className = `ui-toast ui-toast--${kind}`;
  t.innerHTML = icon(ic) + '<span></span>';
  (t.querySelector('span') as HTMLElement).textContent = text;
  toastsEl.appendChild(t);
  while (toastsEl.children.length > 4) toastsEl.firstElementChild?.remove();
  const life = Math.min(6000, 2600 + text.length * 35);
  setTimeout(() => {
    t.classList.add('is-out');
    setTimeout(() => t.remove(), 260);
  }, life);
  t.addEventListener('click', () => t.remove());
}

// ---------------------------------------------------------------- modals
export interface ModalHandle {
  el: HTMLElement;
  close(): void;
  setBody(body: Raw): void;
  dismissable: boolean;
}
const stack: ModalHandle[] = [];
export function modalOpen(): boolean { return stack.length > 0; }

export interface ModalOpts {
  title?: string;
  body: Raw;
  actions?: Raw;
  handlers?: Handlers;
  wide?: boolean;
  cls?: string;
  dismissable?: boolean;
  closeButton?: boolean;
  onClose?: () => void;
  drawer?: boolean;
  sheet?: boolean;
}

export function openModal(o: ModalOpts): ModalHandle {
  const back = document.createElement('div');
  back.className = 'ui-backdrop' + (o.drawer ? ' ui-drawer-back' : '') + (o.sheet ? ' ui-more-backdrop' : '');
  const dismissable = o.dismissable !== false;
  const box = document.createElement('div');
  box.className = o.drawer ? 'ui-drawer' : o.sheet ? 'ui-more-sheet' : `ui-modal${o.wide ? ' ui-modal--wide' : ''}`;
  if (o.cls) box.className += ' ' + o.cls;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  back.appendChild(box);
  let closed = false;
  const handle: ModalHandle = {
    el: box,
    dismissable,
    close() {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      back.remove();
      off();
      o.onClose?.();
    },
    setBody(body: Raw) { render(body); },
  };
  const render = (body: Raw) => {
    box.innerHTML = html`
      ${o.closeButton !== false && dismissable && !o.sheet ? html`<button class="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon ui-modal__close" data-click="__close" aria-label="Close">${raw(icon('x'))}</button>` : ''}
      ${o.title ? html`<h2 class="ui-modal__title">${o.title}</h2>` : ''}
      <div class="ui-modal__content">${body}</div>
      ${o.actions ? html`<div class="ui-modal__actions">${o.actions}</div>` : ''}
    `.s;
  };
  render(o.body);
  const off = delegate(box, () => ({ ...(o.handlers || {}), __close: () => handle.close() }));
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back && dismissable) handle.close();
  });
  root.appendChild(back);
  stack.push(handle);
  requestAnimationFrame(() => {
    const f = box.querySelector<HTMLElement>('[autofocus], .ui-modal__actions .ui-btn--primary, .ui-modal__actions .ui-btn--go');
    if (f && !isTouch()) f.focus({ preventScroll: true });
  });
  return handle;
}

export function closeAllModals(): void {
  while (stack.length) stack[stack.length - 1].close();
}

function isTouch(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

export function confirmDialog(o: { title: string; body?: string | Raw; ok?: string; cancel?: string; danger?: boolean; icon?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const body = typeof o.body === 'string' ? html`<p class="ui-modal__body">${o.body}</p>` : o.body || html``;
    const m = openModal({
      title: o.title,
      body,
      closeButton: false,
      actions: html`
        <button class="ui-btn ui-btn--ghost" data-click="no">${o.cancel || 'Cancel'}</button>
        <button class="ui-btn ${o.danger ? 'ui-btn--danger' : 'ui-btn--primary'}" data-click="yes">${o.ok || 'Confirm'}</button>`,
      handlers: {
        yes: () => { answered = true; m.close(); resolve(true); },
        no: () => { answered = true; m.close(); resolve(false); },
      },
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

// ---------------------------------------------------------------- popovers (anchored, closes on outside tap)
let popEl: HTMLElement | null = null;
let popOff: (() => void) | null = null;
export function popover(anchor: HTMLElement, content: Raw, handlers?: Handlers): void {
  closePopover();
  const p = document.createElement('div');
  p.className = 'ui-pop';
  p.innerHTML = content.s;
  root.appendChild(p);
  const r = anchor.getBoundingClientRect();
  const pw = p.offsetWidth;
  const ph = p.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(10, Math.min(window.innerWidth - pw - 10, left));
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 8);
  p.style.left = `${left}px`;
  p.style.top = `${top}px`;
  popEl = p;
  const offD = handlers ? delegate(p, () => handlers) : () => {};
  const outside = (e: PointerEvent) => {
    if (!popEl) return;
    if (popEl.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
    closePopover();
  };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  popOff = () => { offD(); document.removeEventListener('pointerdown', outside, true); };
}
export function closePopover(): void {
  popOff?.();
  popOff = null;
  popEl?.remove();
  popEl = null;
}
export function popoverOpen(): boolean { return !!popEl; }

// ---------------------------------------------------------------- tooltips: any element with data-tip
let tipEl: HTMLElement | null = null;
let tipFor: HTMLElement | null = null;
function initTooltips(): void {
  const show = (t: HTMLElement) => {
    const text = t.dataset.tip;
    if (!text) return;
    hide();
    tipFor = t;
    tipEl = document.createElement('div');
    tipEl.className = 'ui-tip';
    tipEl.textContent = text;
    document.body.appendChild(tipEl);
    const r = t.getBoundingClientRect();
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    let top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  };
  const hide = () => { tipEl?.remove(); tipEl = null; tipFor = null; };
  document.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    const t = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]');
    if (t && t !== tipFor) show(t);
    else if (!t && tipFor) hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]');
    if (t) show(t);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('scroll', hide, true);
  // Touch: long-press shows the tooltip
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener('touchstart', (e) => {
    const t = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]');
    if (!t) return;
    pressTimer = setTimeout(() => { show(t); setTimeout(hide, 2200); }, 450);
  }, { passive: true });
  const cancel = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; };
  document.addEventListener('touchend', cancel, { passive: true });
  document.addEventListener('touchmove', cancel, { passive: true });
}

// ---------------------------------------------------------------- click sound on every button
export function initClickSounds(): void {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest?.('button, .ui-btn, [role="button"]');
    if (b && !(b as HTMLButtonElement).disabled) {
      try { audio.play('click', { volume: 0.6 }); } catch { /* ignore */ }
    }
  }, true);
}
