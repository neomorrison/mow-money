// Portraits with a CSS fallback, the mood face, and small DOM helpers for the pitch module.
import { portraitUrl } from '../data/assets';
import { probeImage } from '../core/assets';
import type { Mood } from '../sim/negotiation';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s: string | number): string { return String(s).replace(/[&<>"']/g, (c) => ESC[c]); }

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

const AVATAR_COLORS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8ab17d', '#6d597a', '#f4a261', '#457b9d', '#b5838d', '#588157', '#bc6c25'];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * A portrait element: a colored circle with initials right away, swapped for the real image when it loads.
 * `unknown` renders a silhouette (owner not met yet).
 */
export function portrait(key: string, name: string, opts: { unknown?: boolean; cls?: string; bust?: boolean } = {}): HTMLElement {
  const wrap = el('div', `pitch-portrait ${opts.cls ?? ''}`);
  if (opts.unknown) {
    wrap.classList.add('is-unknown');
    wrap.innerHTML = SILHOUETTE;
    wrap.setAttribute('aria-label', 'Not met yet');
    return wrap;
  }
  wrap.style.setProperty('--av', colorFor(name));
  wrap.innerHTML = opts.bust
    ? `<span class="pitch-bust" aria-hidden="true">${cartoonBust(key, name)}</span><span class="pitch-initials pitch-initials-tag" aria-hidden="true">${esc(initials(name))}</span>`
    : `<span class="pitch-initials" aria-hidden="true">${esc(initials(name))}</span>`;
  wrap.setAttribute('aria-label', name);
  const url = portraitUrl(key);
  probeImage(url).then((ok) => {
    if (!ok) return;
    const img = new Image();
    img.src = url;
    img.alt = name;
    img.decoding = 'async';
    img.className = 'pitch-portrait-img';
    wrap.appendChild(img);
    wrap.classList.add('has-img');
  });
  return wrap;
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** A friendly cartoon bust drawn from the portrait key and name, used until the real portrait loads. */
export function cartoonBust(key: string, name: string): string {
  const h = hashOf(key + '|' + name);
  const pick = <T,>(arr: T[], salt: number) => arr[(h >>> salt) % arr.length];
  const arch = key.replace(/^p_/, '').replace(/_\d+$/, '');
  const skins = ['#f6d3b8', '#eab58f', '#d39a6f', '#b07650', '#8a5a3c', '#f1c89a', '#6b4430'];
  const older = arch === 'retiree' || arch === 'veteran' || arch === 'greenskeeper';
  const hairs = older ? ['#d9d4c8', '#b9b4aa', '#eeeae2', '#8c8c8c'] : ['#2b1d14', '#5a3a22', '#8b5a2b', '#c99a55', '#1d1d1d', '#a0522d', '#d8b46a'];
  const skin = pick(skins, 3);
  const hair = pick(hairs, 7);
  const shirt = colorFor(name);
  const style = arch === 'dude' || arch === 'eco' ? 2 : (h >>> 11) % 4;         // 0 short, 1 side part, 2 long, 3 bun
  const glasses = arch === 'perfectionist' || arch === 'techie' || arch === 'hoa' || ((h >>> 13) % 5 === 0);
  const tie = arch === 'executive' || arch === 'facilities' || arch === 'landlord';
  const cap = arch === 'parks' || arch === 'greenskeeper' || arch === 'veteran' && (h >>> 17) % 2 === 0;
  const beard = !['retiree', 'newcouple', 'family'].includes(arch) && (h >>> 19) % 4 === 0;
  const hairBack = style === 2 ? `<path d="M26 44 Q24 86 34 96 L66 96 Q76 86 74 44 Z" fill="${hair}"/>` : style === 3 ? `<circle cx="50" cy="16" r="9" fill="${hair}"/>` : '';
  const hairTop = style === 1
    ? `<path d="M29 44 Q28 20 50 19 Q72 20 71 44 Q66 32 44 30 Q36 34 29 44 Z" fill="${hair}"/>`
    : `<path d="M28 46 Q27 18 50 18 Q73 18 72 46 Q70 31 50 29 Q30 31 28 46 Z" fill="${hair}"/>`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet">
    ${hairBack}
    <path d="M10 100 Q12 74 36 70 L64 70 Q88 74 90 100 Z" fill="${shirt}" stroke="#2f3a2c" stroke-width="2.5"/>
    ${tie ? '<path d="M46 71 L54 71 L56 86 L50 94 L44 86 Z" fill="#2f3a2c"/>' : '<path d="M40 70 Q50 80 60 70" fill="none" stroke="#2f3a2c" stroke-width="2.5"/>'}
    <rect x="43" y="58" width="14" height="14" rx="4" fill="${skin}"/>
    <ellipse cx="50" cy="44" rx="21" ry="24" fill="${skin}" stroke="#2f3a2c" stroke-width="2.5"/>
    <ellipse cx="29" cy="46" rx="3.5" ry="5" fill="${skin}" stroke="#2f3a2c" stroke-width="2"/>
    <ellipse cx="71" cy="46" rx="3.5" ry="5" fill="${skin}" stroke="#2f3a2c" stroke-width="2"/>
    ${cap ? `<path d="M28 38 Q29 18 50 18 Q71 18 72 38 Z" fill="${arch === 'greenskeeper' ? '#2f6b2f' : '#b8322a'}" stroke="#2f3a2c" stroke-width="2.5"/><path d="M50 36 L82 38 Q80 42 50 40 Z" fill="${arch === 'greenskeeper' ? '#2f6b2f' : '#b8322a'}" stroke="#2f3a2c" stroke-width="2"/>` : hairTop}
    <circle cx="42" cy="46" r="2.6" fill="#2f3a2c"/><circle cx="58" cy="46" r="2.6" fill="#2f3a2c"/>
    <path d="M37 39 Q42 36 46 39 M54 39 Q58 36 63 39" stroke="#2f3a2c" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${glasses ? '<circle cx="42" cy="46" r="6" fill="none" stroke="#2f3a2c" stroke-width="2"/><circle cx="58" cy="46" r="6" fill="none" stroke="#2f3a2c" stroke-width="2"/><path d="M48 46 L52 46" stroke="#2f3a2c" stroke-width="2"/>' : ''}
    ${beard ? `<path d="M31 50 Q33 70 50 70 Q67 70 69 50 Q62 60 50 60 Q38 60 31 50 Z" fill="${hair}"/>` : ''}
    <path d="M43 57 Q50 62 57 57" stroke="#2f3a2c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="36" cy="54" r="3.5" fill="#ff8a7a" opacity=".35"/><circle cx="64" cy="54" r="3.5" fill="#ff8a7a" opacity=".35"/>
  </svg>`;
}

const SILHOUETTE = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="38" r="19" fill="currentColor"/><path d="M14 100c2-24 17-36 36-36s34 12 36 36z" fill="currentColor"/></svg>`;

/** Mood face SVG. `warmth` 0..1 tints the cheeks and eyebrows. */
export function moodFace(mood: Mood, warmth: number): string {
  const faces: Record<Mood, { mouth: string; brow: number; col: string; eyes?: string }> = {
    pleased: { mouth: 'M32 62 Q50 78 68 62', brow: -3, col: '#8ccf5f' },
    accept: { mouth: 'M30 58 Q50 84 70 58 Z', brow: -4, col: '#5cbf5a', eyes: 'happy' },
    neutral: { mouth: 'M35 66 L65 66', brow: 0, col: '#f2cf5b' },
    close: { mouth: 'M34 66 Q50 62 66 68', brow: 2, col: '#f7c548' },
    steep: { mouth: 'M34 70 Q50 58 66 70', brow: 5, col: '#f39c4a' },
    offended: { mouth: 'M32 72 Q50 54 68 72', brow: 9, col: '#e8574a', eyes: 'angry' },
  };
  const f = faces[mood];
  const eyes = f.eyes === 'happy'
    ? '<path d="M33 44 Q38 38 43 44" stroke="#2d2a26" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M57 44 Q62 38 67 44" stroke="#2d2a26" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    : '<circle cx="38" cy="45" r="4.2" fill="#2d2a26"/><circle cx="62" cy="45" r="4.2" fill="#2d2a26"/>';
  const b = f.brow;
  const brows = f.eyes === 'angry'
    ? `<path d="M29 ${31} L45 ${36 + b / 3}" stroke="#2d2a26" stroke-width="3.5" stroke-linecap="round"/><path d="M71 ${31} L55 ${36 + b / 3}" stroke="#2d2a26" stroke-width="3.5" stroke-linecap="round"/>`
    : `<path d="M30 ${34 + b / 2} Q38 ${31 - b / 3} 45 ${34 - b / 2}" stroke="#2d2a26" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M55 ${34 - b / 2} Q62 ${31 - b / 3} 70 ${34 + b / 2}" stroke="#2d2a26" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const cheek = Math.max(0, Math.min(1, warmth));
  const fill = f.eyes === 'happy' || mood === 'accept' ? '#7a2e2e' : 'none';
  return `<svg class="pitch-face" viewBox="0 0 100 100" role="img" aria-label="Mood: ${MOOD_LABEL[mood]}">
    <circle cx="50" cy="50" r="46" fill="${f.col}" stroke="#2d2a26" stroke-width="3"/>
    <circle cx="27" cy="58" r="7" fill="#ff7a7a" opacity="${(0.15 + cheek * 0.5).toFixed(2)}"/>
    <circle cx="73" cy="58" r="7" fill="#ff7a7a" opacity="${(0.15 + cheek * 0.5).toFixed(2)}"/>
    ${brows}${eyes}
    <path d="${f.mouth}" stroke="#2d2a26" stroke-width="3.5" fill="${fill}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export const MOOD_LABEL: Record<Mood, string> = {
  pleased: 'Warming up',
  accept: 'Happy',
  neutral: 'Listening',
  close: 'Tempted',
  steep: 'Skeptical',
  offended: 'Offended',
};

export const PREVIEW_LABEL: Record<Mood, string> = {
  pleased: 'Easy yes',
  accept: 'Likely yes',
  neutral: 'Unsure',
  close: 'Close',
  steep: 'Too steep',
  offended: 'Offensive',
};
