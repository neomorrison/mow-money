// Tiny HTML templating: html`...` escapes every interpolation unless it is Raw (another html`` result
// or raw('...')). Arrays are joined. null, undefined and false render nothing.

export class Raw {
  constructor(public readonly s: string) {}
  toString(): string { return this.s; }
}

export function raw(s: string): Raw { return new Raw(s); }

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ESC[c]); }

function part(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(String(v));
}

export function html(strings: TemplateStringsArray, ...vals: unknown[]): Raw {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

export function when(cond: unknown, a: () => Raw | string, b?: () => Raw | string): Raw {
  const r = cond ? a() : b ? b() : '';
  return r instanceof Raw ? r : new Raw(esc(r));
}

export function setHtml(el: Element, content: Raw): void { el.innerHTML = content.s; }

/** Build a DOM element from an html`` result (first element child). */
export function el<T extends HTMLElement = HTMLElement>(content: Raw): T {
  const t = document.createElement('template');
  t.innerHTML = content.s.trim();
  return t.content.firstElementChild as T;
}

// ---------------------------------------------------------------- delegated events
// Elements declare data-click="name", data-change="name" or data-input="name"; the host
// dispatches to handlers[name](el, event). data-* values on the element carry parameters.
export type Handler = (el: HTMLElement, ev: Event) => void;
export type Handlers = Record<string, Handler>;

export function delegate(root: HTMLElement, get: () => Handlers | null | undefined): () => void {
  const fire = (attr: string) => (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target || !target.closest) return;
    const hit = target.closest<HTMLElement>(`[data-${attr}]`);
    if (!hit || !root.contains(hit)) return;
    if (attr === 'click' && (hit as HTMLButtonElement).disabled) return;
    const name = hit.dataset[attr];
    const handlers = get();
    const fn = name && handlers ? handlers[name] : undefined;
    if (fn) {
      if (attr === 'click') ev.preventDefault();
      fn(hit, ev);
    }
  };
  const c = fire('click');
  const ch = fire('change');
  const inp = fire('input');
  root.addEventListener('click', c);
  root.addEventListener('change', ch);
  root.addEventListener('input', inp);
  return () => {
    root.removeEventListener('click', c);
    root.removeEventListener('change', ch);
    root.removeEventListener('input', inp);
  };
}
