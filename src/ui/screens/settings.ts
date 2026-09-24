// Settings: audio, graphics, gameplay, save export/import/delete, controls reference.
import * as sim from '../../sim';
import * as mowModule from '../../mow';
import { store } from '../../core/store';
import { exportSave, importSave, type Settings } from '../../core/save';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import { confirmDialog, openModal, toast, type ModalHandle } from '../overlay';
import { deleteSaveFlow } from '../flows';
import { prefs } from '../prefs';
import { safe } from '../kit';
import { rerender } from '../app';

interface ControlRow { action: string; keys: string; touch: string; pad: string }
const DEFAULT_CONTROLS: ControlRow[] = [
  { action: 'Drive', keys: 'W A S D or arrow keys', touch: 'Left stick', pad: 'Left stick' },
  { action: 'Deck height', keys: 'Q lower, E raise', touch: 'Deck buttons', pad: 'Bumpers' },
  { action: 'Switch tool', keys: '1 mower, 2 trimmer, 3 blower', touch: 'Tool buttons', pad: 'D-pad' },
  { action: 'Camera', keys: 'C', touch: 'Camera button', pad: 'Y' },
  { action: 'Pause', keys: 'Esc or P', touch: 'Pause button', pad: 'Start' },
  { action: 'Finish job', keys: 'F when done', touch: 'Finish button', pad: 'X' },
];

function controls(): ControlRow[] {
  const c = (mowModule as unknown as Record<string, unknown>).CONTROLS;
  if (Array.isArray(c) && c.length && typeof c[0] === 'object') return c as ControlRow[];
  return DEFAULT_CONTROLS;
}

let exportText = '';
let importText = '';

function slider(label: string, key: 'master' | 'music' | 'sfx', v: number): Raw {
  return html`<div class="ui-set-row">
    <span class="ui-set-row__l">${label}</span>
    <input type="range" class="ui-range" min="0" max="100" step="5" value="${Math.round(v * 100)}" style="--p:${Math.round(v * 100)}" data-input="vol" data-key="${key}" aria-label="${label}">
    <span class="ui-set-row__v ui-num" data-vol-out="${key}">${Math.round(v * 100)}</span>
  </div>`;
}

function seg<T extends string>(key: keyof Settings, value: T, opts: [T, string][]): Raw {
  return html`<div class="ui-seg">${opts.map(([v, l]) => html`<button class="${value === v ? 'is-on' : ''}" data-click="seg" data-key="${key}" data-v="${v}">${l}</button>`)}</div>`;
}

function toggle(key: keyof Settings, on: boolean, label: string, sub?: string): Raw {
  return html`<label class="ui-toggle ui-set-toggle"><input type="checkbox" ${on ? raw('checked') : ''} data-change="toggle" data-key="${key}"><span class="ui-toggle__track"></span><span class="ui-grow"><b>${label}</b>${sub ? html`<br><span class="ui-tiny ui-muted">${sub}</span>` : ''}</span></label>`;
}

export function settingsBody(inGame: boolean): Raw {
  const s = prefs.s;
  return html`
  <div class="ui-settings">
    <section class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('volume'))}Sound</span></div>
      ${slider('Master', 'master', s.master)}
      ${slider('Music', 'music', s.music)}
      ${slider('Effects', 'sfx', s.sfx)}
    </section>
    <section class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('eye'))}Graphics</span></div>
      <div class="ui-set-row"><span class="ui-set-row__l">Grass density</span>${seg('grassDensity', s.grassDensity, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}</div>
      <div class="ui-set-row"><span class="ui-set-row__l">Camera</span>${seg('cameraMode', s.cameraMode, [['chase', 'Behind'], ['top', 'Top down']])}</div>
      ${toggle('shadows', s.shadows, 'Shadows', 'Turn off for smoother play on older devices.')}
    </section>
    <section class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('sparkle'))}Gameplay</span></div>
      ${toggle('showHints', s.showHints, 'Hints', 'Tutorial steps and tips.')}
      ${toggle('reducedMotion', s.reducedMotion, 'Reduced motion', 'Fewer animations in menus.')}
    </section>
    <section class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('download'))}Save</span></div>
      <p class="ui-small ui-muted">Progress saves in this browser (cookies with a local copy). Export a code to back it up or move it to another device.</p>
      ${inGame ? html`
        <div class="ui-row ui-row--wrap" style="margin-top:12px;gap:8px">
          <button class="ui-btn ui-btn--sm" data-click="export">${raw(icon('download'))}Export save code</button>
          ${exportText ? html`<button class="ui-btn ui-btn--sm ui-btn--soft" data-click="copy">${raw(icon('check'))}Copy</button>` : ''}
        </div>
        ${exportText ? html`<textarea class="ui-textarea" style="margin-top:10px" readonly aria-label="Save code">${exportText}</textarea>` : ''}` : ''}
      <div class="ui-label" style="margin-top:14px">Import a save code</div>
      <textarea class="ui-textarea" style="margin-top:6px" placeholder="MOW1:..." data-input="importText" aria-label="Save code to import">${importText}</textarea>
      <div class="ui-row ui-row--wrap" style="margin-top:10px;gap:8px">
        <button class="ui-btn ui-btn--sm" data-click="import">${raw(icon('upload'))}Load save code</button>
        <span class="ui-grow"></span>
        <button class="ui-btn ui-btn--sm ui-btn--ghost ui-bad" data-click="delete">${raw(icon('trash'))}Delete save</button>
      </div>
    </section>
    <section class="ui-card ui-card--flat ui-settings__wide">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('keyboard'))}Controls while mowing</span></div>
      <div class="ui-controls">
        <div class="ui-controls__h"><span></span><span>${raw(icon('keyboard'))}Keyboard</span><span>${raw(icon('touch'))}Touch</span><span>${raw(icon('gamepad'))}Gamepad</span></div>
        ${controls().map((c) => html`<div class="ui-controls__r"><b>${c.action}</b><span>${c.keys}</span><span>${c.touch}</span><span>${c.pad}</span></div>`)}
      </div>
      <p class="ui-tiny ui-muted" style="margin-top:10px">Menus: 1 to 7 switch tabs, Enter ends the day on the Today screen, Esc closes dialogs.</p>
    </section>
  </div>`;
}

let modal: ModalHandle | null = null;

function refresh(): void {
  if (modal) modal.setBody(settingsBody(store.loaded));
  else rerender();
}

export const settingsHandlers = {
  vol: (el: HTMLElement) => {
    const key = el.dataset.key as 'master' | 'music' | 'sfx';
    const v = Number((el as HTMLInputElement).value) / 100;
    prefs.update({ [key]: v } as Partial<Settings>);
    (el as HTMLInputElement).style.setProperty('--p', String(Math.round(v * 100)));
    const out = el.parentElement?.querySelector(`[data-vol-out="${key}"]`);
    if (out) out.textContent = String(Math.round(v * 100));
  },
  seg: (el: HTMLElement) => {
    prefs.update({ [el.dataset.key as string]: el.dataset.v } as Partial<Settings>);
    refresh();
  },
  toggle: (el: HTMLElement) => {
    prefs.update({ [el.dataset.key as string]: (el as HTMLInputElement).checked } as Partial<Settings>);
    if (el.dataset.key === 'showHints' && store.loaded) store.commit();
  },
  export: () => {
    if (!store.loaded) return;
    exportText = exportSave(store.state);
    refresh();
  },
  copy: async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      toast('Save code copied.', 'good');
    } catch {
      toast('Select the code and copy it.', 'info');
    }
  },
  importText: (el: HTMLElement) => { importText = (el as HTMLTextAreaElement).value; },
  import: async () => {
    const st = importSave(importText);
    if (!st) { toast('That save code is not valid.', 'bad'); return; }
    if (store.loaded) {
      const ok = await confirmDialog({ title: 'Load this save?', body: `${st.company?.name || 'This company'} replaces your current company.`, ok: 'Load save', danger: true });
      if (!ok) return;
    }
    store.set(safe(() => sim.migrate(st), st));
    store.commit({ saveNow: true });
    importText = '';
    modal?.close();
    toast(`Loaded ${st.company?.name || 'save'}.`, 'good');
    navigate('hub');
  },
  delete: () => { modal?.close(); void deleteSaveFlow(); },
};

export function openSettingsModal(): void {
  exportText = '';
  modal = openModal({
    title: 'Settings',
    wide: true,
    body: settingsBody(store.loaded),
    handlers: settingsHandlers,
    onClose: () => { modal = null; },
  });
}

export const settingsScreen: Screen = {
  id: 'settings',
  render: () => html`
    <div class="ui-page-head"><div class="ui-page-head__text"><h1>Settings</h1><p>Changes save right away.</p></div>
      <button class="ui-btn ui-btn--ghost" data-click="title">${raw(icon('exit'))}Title screen</button></div>
    ${settingsBody(true)}`,
  handlers: { ...settingsHandlers, title: () => { store.saveNow(); navigate('title'); } },
  unmount() { exportText = ''; },
};

