// Styles for the neighborhood screen and the pitch overlay, injected once. Every class is namespaced
// with `pitch-` so it never collides with the app's design system.

const CSS = `
.pitch-root, .pitch-overlay {
  --p-cream: #fff8e6;
  --p-cream2: #fbefd0;
  --p-card: #fffdf6;
  --p-ink: #2f3a2c;
  --p-ink2: #5d6753;
  --p-ink3: #8b927f;
  --p-line: #e6d6ad;
  --p-grass: #4f9d3a;
  --p-grass-l: #7cc25a;
  --p-grass-d: #2f6b2f;
  --p-sun: #ffcb3d;
  --p-sun-d: #d99a12;
  --p-red: #de5a45;
  --p-sky: #bfe3f5;
  --p-out: 3px solid var(--p-ink);
  --co: #2f8f4e;
  font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--p-ink);
  -webkit-tap-highlight-color: transparent;
}
.pitch-root *, .pitch-overlay * { box-sizing: border-box; }
.pitch-root { position: relative; width: 100%; height: 100%; min-height: 320px; overflow: hidden; background: var(--p-sky); user-select: none; }
.pitch-stage { position: absolute; inset: 0; }
.pitch-canvas { display: block; position: absolute; inset: 0; outline: none; cursor: grab; }
.pitch-canvas:active { cursor: grabbing; }
.pitch-canvas:focus-visible { box-shadow: inset 0 0 0 4px var(--p-sun); }

/* ---------------------------------------------------------------- buttons */
.pitch-btn {
  font-family: 'Baloo 2', 'Nunito', sans-serif; font-weight: 700; font-size: 16px; line-height: 1.1;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 46px; padding: 8px 18px; border-radius: 14px; border: var(--p-out);
  background: var(--p-card); color: var(--p-ink); cursor: pointer;
  box-shadow: 0 4px 0 var(--p-ink); transform: translateY(0); transition: transform .08s, box-shadow .08s, background .15s, filter .15s;
  touch-action: manipulation; white-space: nowrap;
}
.pitch-btn:hover { filter: brightness(1.04); }
.pitch-btn:active, .pitch-btn.is-pressed { transform: translateY(3px); box-shadow: 0 1px 0 var(--p-ink); }
.pitch-btn:focus-visible, .pitch-choice:focus-visible, .pitch-seg:focus-visible, .pitch-step:focus-visible, .pitch-row:focus-visible, .pitch-marker:focus-visible {
  outline: 3px solid var(--p-sun); outline-offset: 3px;
}
.pitch-btn[disabled], .pitch-btn.is-disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: 0 4px 0 var(--p-ink); }
.pitch-btn-go { background: var(--p-grass); color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.25); }
.pitch-btn-sun { background: var(--p-sun); }
.pitch-btn-ghost { background: var(--p-cream); }
.pitch-btn-small { min-height: 36px; font-size: 14px; padding: 4px 12px; border-radius: 11px; box-shadow: 0 3px 0 var(--p-ink); }
.pitch-btn kbd { font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; padding: 1px 5px; border-radius: 6px; background: rgba(0,0,0,.12); color: inherit; opacity: .85; }
.pitch-btn-go kbd { background: rgba(0,0,0,.2); }
@media (hover: none) { .pitch-btn kbd, .pitch-key { display: none; } }

.pitch-panelbox { background: var(--p-cream); border: var(--p-out); border-radius: 20px; box-shadow: 0 6px 0 rgba(47,58,44,.9); }

/* ---------------------------------------------------------------- header */
.pitch-top { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: flex-start; gap: 10px; pointer-events: none; z-index: 20; }
.pitch-top > * { pointer-events: auto; }
.pitch-title { padding: 6px 16px 8px; min-width: 0; }
.pitch-title h1 { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 24px; line-height: 1.1; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pitch-title p { margin: 0; font-size: 13px; color: var(--p-ink2); font-weight: 700; white-space: nowrap; }
.pitch-spacer { flex: 1; }
.pitch-clock { display: flex; align-items: center; gap: 10px; padding: 6px 14px 6px 10px; }
.pitch-clock-icon { width: 34px; height: 34px; border-radius: 50%; background: var(--p-sun); border: var(--p-out); display: grid; place-items: center; }
.pitch-clock-time { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 20px; line-height: 1; }
.pitch-clock-left { font-size: 12px; font-weight: 800; color: var(--p-ink2); }
.pitch-clock.is-late .pitch-clock-left { color: var(--p-red); }
.pitch-listtoggle { display: none; }

/* ---------------------------------------------------------------- house list */
.pitch-list { position: absolute; left: 12px; top: 88px; bottom: 12px; width: 300px; display: flex; flex-direction: column; z-index: 15; overflow: hidden; }
.pitch-list-head { padding: 10px 12px 8px; border-bottom: 2px solid var(--p-line); }
.pitch-list-head h2 { font-family: 'Baloo 2', sans-serif; font-size: 18px; margin: 0 0 6px; display: flex; justify-content: space-between; align-items: baseline; }
.pitch-list-head h2 span { font-family: 'Nunito', sans-serif; font-size: 12px; color: var(--p-ink2); font-weight: 800; }
.pitch-sort { display: flex; gap: 4px; flex-wrap: wrap; }
.pitch-sortbtn { font: 800 12px 'Nunito', sans-serif; border: 2px solid var(--p-ink); background: var(--p-card); border-radius: 999px; padding: 3px 10px; cursor: pointer; color: var(--p-ink); }
.pitch-sortbtn.is-on { background: var(--p-ink); color: var(--p-cream); }
.pitch-list-body { overflow-y: auto; padding: 6px; flex: 1; overscroll-behavior: contain; }
.pitch-row { width: 100%; display: grid; grid-template-columns: 30px 1fr auto; gap: 8px; align-items: center; text-align: left; padding: 7px 8px; border-radius: 12px; border: 2px solid transparent; background: transparent; cursor: pointer; font: inherit; color: inherit; }
.pitch-row:hover { background: var(--p-cream2); }
.pitch-row.is-selected { background: #fff3c2; border-color: var(--p-ink); }
.pitch-row-addr { font-weight: 800; font-size: 14px; line-height: 1.15; }
.pitch-row-sub { font-size: 12px; color: var(--p-ink2); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pitch-row-grass { width: 44px; height: 8px; border-radius: 4px; background: #e9e1c8; overflow: hidden; border: 1.5px solid var(--p-ink); }
.pitch-row-grass span { display: block; height: 100%; background: var(--p-grass); }
.pitch-row-grass.is-tall span { background: #b6b43f; }
.pitch-dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 2px solid var(--p-ink); background: #fff; font-size: 13px; font-weight: 900; }

/* status icons shared by rows, markers and cards */
.pitch-ic { width: 16px; height: 16px; display: block; }
.pitch-st-client { background: var(--co); color: #fff; }
.pitch-st-lead { background: var(--p-sun); color: var(--p-ink); }
.pitch-st-hoa { background: #fff3a6; color: var(--p-ink); }
.pitch-st-rival { background: var(--mk, #7a4fb3); color: #fff; }
.pitch-st-cold { background: #b9c1c8; color: var(--p-ink); }
.pitch-st-nosolicit { background: var(--p-red); color: #fff; }
.pitch-st-none { background: #fff; color: var(--p-ink2); }

/* ---------------------------------------------------------------- markers */
.pitch-markers { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; }
.pitch-marker { position: absolute; left: 0; top: 0; width: 0; height: 0; padding: 0; border: 0; background: none; pointer-events: auto; cursor: pointer; }
.pitch-marker .pitch-pin {
  position: absolute; left: -17px; top: -44px; width: 34px; height: 34px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
  border: 3px solid var(--p-ink); display: grid; place-items: center; box-shadow: 0 3px 0 rgba(0,0,0,.25);
  transition: transform .15s;
}
.pitch-marker .pitch-pin > * { transform: rotate(45deg); }
.pitch-marker:hover .pitch-pin { transform: rotate(-45deg) scale(1.12); }
.pitch-marker.is-selected .pitch-pin { transform: rotate(-45deg) scale(1.25); box-shadow: 0 0 0 4px var(--p-sun), 0 3px 0 rgba(0,0,0,.25); }
.pitch-marker-none .pitch-pin { left: -7px; top: -18px; width: 14px; height: 14px; border-width: 2px; opacity: .85; }
.pitch-marker-none .pitch-pin > * { display: none; }
.pitch-marker-none.is-selected .pitch-pin { opacity: 1; }
.pitch-marker-lead .pitch-pin { animation: pitch-glow 1.6s ease-in-out infinite; }
.pitch-marker.is-tutorial .pitch-pin { animation: pitch-bob 1s ease-in-out infinite; box-shadow: 0 0 0 5px rgba(255,203,61,.9), 0 0 24px 8px rgba(255,203,61,.8); }
.pitch-marker .pitch-mlabel {
  position: absolute; left: 0; top: -70px; transform: translateX(-50%); white-space: nowrap; font: 800 12px 'Nunito', sans-serif;
  background: var(--p-card); border: 2px solid var(--p-ink); border-radius: 999px; padding: 2px 9px; opacity: 0; transition: opacity .15s; pointer-events: none;
}
.pitch-marker:hover .pitch-mlabel, .pitch-marker.is-selected .pitch-mlabel, .pitch-marker.is-tutorial .pitch-mlabel { opacity: 1; }
@keyframes pitch-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,203,61,.0), 0 3px 0 rgba(0,0,0,.25); } 50% { box-shadow: 0 0 18px 6px rgba(255,214,90,.95), 0 3px 0 rgba(0,0,0,.25); } }
@keyframes pitch-bob { 0%,100% { translate: 0 0; } 50% { translate: 0 -8px; } }

/* ---------------------------------------------------------------- house card */
.pitch-card { position: absolute; right: 12px; top: 88px; width: 368px; max-height: calc(100% - 100px); overflow-y: auto; z-index: 16; padding: 0 0 14px; overscroll-behavior: contain; }
.pitch-card[hidden] { display: none; }
.pitch-card-head { display: grid; grid-template-columns: 72px 1fr auto; gap: 12px; padding: 14px 14px 10px; align-items: center; border-bottom: 2px solid var(--p-line); position: sticky; top: 0; background: var(--p-cream); z-index: 2; border-radius: 17px 17px 0 0; }
.pitch-card-head h2 { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 22px; line-height: 1.05; margin: 0; }
.pitch-card-head p { margin: 2px 0 0; font-size: 13px; font-weight: 700; color: var(--p-ink2); }
.pitch-x { width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid var(--p-ink); background: var(--p-card); cursor: pointer; display: grid; place-items: center; font: 900 18px 'Nunito', sans-serif; color: var(--p-ink); }
.pitch-card-body { padding: 10px 14px 0; }
.pitch-status-line { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; padding: 8px 10px; border-radius: 12px; background: var(--p-cream2); margin-bottom: 10px; }
.pitch-status-line .pitch-dot { width: 24px; height: 24px; flex: none; }
.pitch-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 12px; }
.pitch-fact { background: var(--p-card); border: 2px solid var(--p-line); border-radius: 12px; padding: 7px 10px; }
.pitch-fact dt { font-size: 11px; font-weight: 800; color: var(--p-ink3); text-transform: uppercase; letter-spacing: .04em; }
.pitch-fact dd { margin: 1px 0 0; font-weight: 800; font-size: 15px; }
.pitch-fact dd small { font-weight: 700; color: var(--p-ink2); font-size: 12px; }
.pitch-grassbar { height: 8px; border-radius: 4px; background: #e9e1c8; margin-top: 5px; overflow: hidden; }
.pitch-grassbar span { display: block; height: 100%; background: linear-gradient(90deg, var(--p-grass), #b6b43f); }
.pitch-flavorline { font-size: 13px; font-style: italic; color: var(--p-ink2); margin: -2px 0 10px; }
.pitch-card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pitch-card-actions .pitch-btn { flex: 1 1 140px; }
.pitch-btn-knock { font-size: 18px; min-height: 52px; }
.pitch-btn-knock small { font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; opacity: .9; }
.pitch-reason { font-size: 13px; font-weight: 700; color: var(--p-ink2); margin: 8px 2px 0; }
.pitch-details { margin-top: 12px; border-top: 2px dashed var(--p-line); padding-top: 10px; }
.pitch-details summary { cursor: pointer; font-weight: 800; font-size: 14px; list-style: none; display: flex; justify-content: space-between; }
.pitch-details summary::-webkit-details-marker { display: none; }
.pitch-details summary::after { content: '+'; font-weight: 900; }
.pitch-details[open] summary::after { content: '-'; }
.pitch-kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin-top: 8px; }
.pitch-kv dt { color: var(--p-ink2); font-weight: 700; }
.pitch-kv dd { margin: 0; font-weight: 800; text-align: right; }
.pitch-satbar { height: 10px; border-radius: 5px; background: #eadfc4; overflow: hidden; border: 1.5px solid var(--p-ink); margin-top: 6px; }
.pitch-satbar span { display: block; height: 100%; }
.pitch-portrait { position: relative; width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: var(--av, #9aa58c); border: 3px solid var(--p-ink); display: grid; place-items: center; flex: none; }
.pitch-portrait.is-unknown { background: #d9d2bf; color: #9c9481; }
.pitch-portrait.is-unknown svg { width: 86%; height: 86%; margin-top: 14%; }
.pitch-initials { font-family: 'Baloo 2', sans-serif; font-weight: 800; color: #fff; font-size: 28px; text-shadow: 0 2px 0 rgba(0,0,0,.2); }
.pitch-portrait-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pitch-portrait.has-img .pitch-initials, .pitch-portrait.has-img .pitch-bust { visibility: hidden; }
.pitch-bust { position: absolute; inset: 0; display: block; }
.pitch-bust svg { width: 100%; height: 100%; display: block; }
.pitch-initials-tag { display: none; }
.pitch-root [hidden], .pitch-overlay [hidden] { display: none !important; }

/* knock animation inside the card */
.pitch-knockfx { position: absolute; inset: 0; background: rgba(255,248,230,.94); display: grid; place-items: center; z-index: 5; border-radius: 17px; }
.pitch-knockfx-door { width: 92px; height: 138px; background: #b8322a; border: 4px solid var(--p-ink); border-radius: 8px 8px 2px 2px; position: relative; transform-origin: left center; box-shadow: inset 0 0 0 8px rgba(255,255,255,.12); }
.pitch-knockfx-door::after { content: ''; position: absolute; right: 12px; top: 64px; width: 12px; height: 12px; border-radius: 50%; background: var(--p-sun); border: 2px solid var(--p-ink); }
.pitch-knockfx.is-knocking .pitch-knockfx-door { animation: pitch-knock .42s ease-in-out 3; }
.pitch-knockfx.is-answered .pitch-knockfx-door { animation: pitch-dooropen .5s ease-out forwards; }
.pitch-knockfx-text { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 20px; margin-top: 10px; text-align: center; }
.pitch-knockfx-wrap { display: flex; flex-direction: column; align-items: center; perspective: 600px; }
@keyframes pitch-knock { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-3px) rotate(-1deg) } 40% { transform: translateX(3px) } 60% { transform: translateX(-2px) } }
@keyframes pitch-dooropen { to { transform: rotateY(-75deg); } }

/* ---------------------------------------------------------------- toasts and hints */
.pitch-toasts { position: absolute; top: 92px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; align-items: center; z-index: 40; pointer-events: none; width: min(460px, calc(100% - 24px)); }
.pitch-toast { background: var(--p-card); border: var(--p-out); border-radius: 16px; padding: 10px 16px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 0 var(--p-ink); animation: pitch-toast-in .25s ease-out; text-align: center; }
.pitch-toast-good { background: #dff3c8; }
.pitch-toast-bad { background: #ffe0d6; }
.pitch-toast.is-out { animation: pitch-toast-out .3s ease-in forwards; }
@keyframes pitch-toast-in { from { transform: translateY(-12px) scale(.96); opacity: 0; } }
@keyframes pitch-toast-out { to { transform: translateY(-10px); opacity: 0; } }
.pitch-hint { position: absolute; left: 386px; bottom: 16px; z-index: 18; display: flex; align-items: center; gap: 10px; padding: 10px 14px; width: max-content; max-width: min(560px, calc(100% - 400px)); font-weight: 800; background: #fff3c2; }
.pitch-root.has-card .pitch-hint { display: none; }
.pitch-hint-arrow { width: 30px; height: 30px; border-radius: 50%; background: var(--p-sun); border: var(--p-out); flex: none; display: grid; place-items: center; animation: pitch-bob 1s ease-in-out infinite; }
.pitch-zoom { position: absolute; left: 324px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 14; }
.pitch-zoom .pitch-btn { width: 46px; padding: 0; font-size: 22px; }
.pitch-empty { position: absolute; inset: 0; display: grid; place-items: center; z-index: 30; }
.pitch-empty .pitch-panelbox { padding: 20px 24px; max-width: 420px; text-align: center; font-weight: 700; }

/* ---------------------------------------------------------------- pitch overlay */
.pitch-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(31,44,28,.55); backdrop-filter: blur(3px); animation: pitch-fade .2s ease-out; }
.pitch-overlay.is-leaving { animation: pitch-fadeout .22s ease-in forwards; }
@keyframes pitch-fade { from { opacity: 0; } }
@keyframes pitch-fadeout { to { opacity: 0; } }
.pitch-dialog { position: relative; width: min(1180px, 100%); height: min(780px, 100%); display: grid; grid-template-columns: minmax(300px, 380px) 1fr; background: var(--p-cream); border: 4px solid var(--p-ink); border-radius: 28px; box-shadow: 0 10px 0 rgba(0,0,0,.3); overflow: hidden; animation: pitch-pop .28s cubic-bezier(.2,1.4,.4,1); }
@keyframes pitch-pop { from { transform: translateY(20px) scale(.97); opacity: 0; } }

.pitch-doorside {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 26px 22px 18px; border-right: 4px solid var(--p-ink);
  background: repeating-linear-gradient(180deg, #a9cfe0 0 22px, #98c1d4 22px 24px);
}
.pitch-doorframe { position: relative; width: 236px; padding: 14px 14px 0; background: #fffdf6; border: var(--p-out); border-bottom: 0; border-radius: 14px 14px 0 0; box-shadow: 0 0 0 6px rgba(255,255,255,.35); }
.pitch-doorway { position: relative; height: 300px; border: var(--p-out); border-bottom: 0; border-radius: 6px 6px 0 0; overflow: hidden; perspective: 900px; background: linear-gradient(180deg, #f6d9a3, #d59a57); }
.pitch-doorway-inner { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; }
.pitch-doorway-inner::before { content: ''; position: absolute; left: 12%; right: 12%; top: 10%; height: 28%; border: 3px solid rgba(90,60,30,.35); border-radius: 6px; background: rgba(255,255,255,.25); }
.pitch-portrait-xl { width: 100%; height: auto; aspect-ratio: 1; border-radius: 0; border: 0; background: transparent; overflow: visible; }
.pitch-portrait-xl .pitch-initials { font-size: 72px; }
.pitch-portrait-xl.has-img { position: absolute; inset: 0; width: 100%; height: 100%; aspect-ratio: auto; }
.pitch-portrait-xl .pitch-portrait-img { object-position: 50% 30%; }
.pitch-doorway-inner:has(.has-img)::before { display: none; }
.pitch-door-leaf { position: absolute; inset: 0; background: #c0392b; transform-origin: left center; transition: transform .75s cubic-bezier(.3,.9,.4,1.05) .15s; border-right: 3px solid var(--p-ink); z-index: 3; }
.pitch-overlay.is-open .pitch-door-leaf { transform: rotateY(-104deg); }
.pitch-knob { position: absolute; right: 14px; top: 52%; width: 14px; height: 14px; border-radius: 50%; background: var(--p-sun); border: 2px solid var(--p-ink); }
.pitch-door-leaf .pitch-panel { position: absolute; left: 16%; right: 16%; border: 3px solid rgba(0,0,0,.22); border-radius: 6px; }
.pitch-door-leaf .p1 { top: 8%; height: 34%; }
.pitch-door-leaf .p2 { top: 50%; height: 40%; }
.pitch-porchlight { position: absolute; left: -34px; top: 60px; width: 22px; height: 34px; border-radius: 8px 8px 4px 4px; background: #fff2b3; border: var(--p-out); box-shadow: 0 0 24px 10px rgba(255,226,120,.75); animation: pitch-flicker 4s ease-in-out infinite; }
@keyframes pitch-flicker { 0%,100% { box-shadow: 0 0 24px 10px rgba(255,226,120,.75); } 47% { box-shadow: 0 0 20px 8px rgba(255,226,120,.6); } 50% { box-shadow: 0 0 26px 12px rgba(255,226,120,.85); } }
.pitch-housenum { position: absolute; right: -40px; top: 40px; background: #2f3a2c; color: #fff8e6; font: 800 16px 'Baloo 2', sans-serif; padding: 2px 8px; border-radius: 6px; border: 2px solid #fff8e6; box-shadow: 0 0 0 2px var(--p-ink); }
.pitch-mat { position: absolute; left: 10%; right: 10%; bottom: -16px; height: 18px; background: #8a5a36; border: 2px solid var(--p-ink); border-radius: 4px; color: #f0d9a8; font: 800 10px 'Nunito', sans-serif; letter-spacing: .3em; display: grid; place-items: center; z-index: 4; }
.pitch-who { text-align: center; margin-top: 16px; background: var(--p-cream); border: var(--p-out); border-radius: 16px; padding: 8px 14px; width: 100%; box-shadow: 0 4px 0 rgba(47,58,44,.85); }
.pitch-name { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 24px; line-height: 1.05; }
.pitch-arch { font-weight: 800; font-size: 13px; color: var(--p-grass-d); text-transform: uppercase; letter-spacing: .05em; }
.pitch-flavor { font-size: 13px; color: var(--p-ink2); font-style: italic; margin-top: 2px; }
.pitch-moodrow { display: flex; gap: 12px; align-items: center; width: 100%; background: var(--p-cream); border: var(--p-out); border-radius: 16px; padding: 8px 12px; box-shadow: 0 4px 0 rgba(47,58,44,.85); }
.pitch-facewrap { width: 64px; height: 64px; flex: none; }
.pitch-face { width: 100%; height: 100%; display: block; }
.pitch-moodinfo { flex: 1; min-width: 0; }
.pitch-moodlabel { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 18px; line-height: 1.1; }
.pitch-meter { height: 10px; border-radius: 5px; background: #eadfc4; border: 2px solid var(--p-ink); overflow: hidden; margin: 5px 0; }
.pitch-meter-fill { display: block; height: 100%; width: 40%; background: linear-gradient(90deg, #f39c4a, #ffcb3d 45%, #7cc25a); transition: width .5s ease; }
.pitch-pips { display: flex; align-items: center; gap: 5px; }
.pitch-pips-label { font-size: 11px; font-weight: 800; color: var(--p-ink2); text-transform: uppercase; letter-spacing: .04em; margin-right: 3px; }
.pitch-pip { width: 13px; height: 13px; border-radius: 50%; border: 2px solid var(--p-ink); background: #eadfc4; transition: background .3s, transform .3s; }
.pitch-pip.is-on { background: var(--p-sun); }
.pitch-react-good .pitch-facewrap { animation: pitch-hop .5s ease-out; }
.pitch-react-bad .pitch-facewrap { animation: pitch-shake .45s ease-in-out; }
@keyframes pitch-hop { 30% { transform: translateY(-8px) scale(1.06); } 60% { transform: translateY(0) scale(.98); } }
@keyframes pitch-shake { 20% { transform: translateX(-5px) rotate(-4deg); } 40% { transform: translateX(5px) rotate(4deg); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
.pitch-shake { animation: pitch-shake .4s ease-in-out; }

.pitch-notes { list-style: none; margin: 0; padding: 8px 12px; width: 100%; background: rgba(255,248,230,.85); border: 2px dashed rgba(47,58,44,.45); border-radius: 14px; display: flex; flex-wrap: wrap; gap: 6px; }
.pitch-notes li { font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: var(--p-card); border: 2px solid var(--p-line); }
.pitch-notes li.is-good { background: #e4f6d2; border-color: #a9d38a; }
.pitch-notes li.is-bad { background: #fde3da; border-color: #efb3a2; }
.pitch-talkside { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.pitch-talkhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px 10px; border-bottom: 2px solid var(--p-line); }
.pitch-address { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 22px; line-height: 1.1; }
.pitch-sub { font-size: 13px; font-weight: 700; color: var(--p-ink2); }
.pitch-log { flex: 1; min-height: 80px; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; background: radial-gradient(circle at 20% 0%, #fffdf3, var(--p-cream) 60%); overscroll-behavior: contain; }
.pitch-bubble { max-width: 78%; padding: 8px 14px 10px; border: 2.5px solid var(--p-ink); border-radius: 18px; font-size: 16px; line-height: 1.35; position: relative; animation: pitch-bubble-in .22s ease-out; box-shadow: 0 3px 0 rgba(47,58,44,.8); }
.pitch-bubble-who { display: block; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; color: var(--p-ink2); margin-bottom: 1px; }
.pitch-bubble-them { align-self: flex-start; background: #fff; border-bottom-left-radius: 6px; }
.pitch-bubble-you { align-self: flex-end; background: #dcf2c6; border-bottom-right-radius: 6px; }
.pitch-typing { display: flex; gap: 5px; padding: 12px 16px; }
.pitch-typing span { width: 8px; height: 8px; border-radius: 50%; background: var(--p-ink2); animation: pitch-dots 1s infinite ease-in-out; }
.pitch-typing span:nth-child(2) { animation-delay: .15s; }
.pitch-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes pitch-dots { 0%,100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-5px); opacity: 1; } }
@keyframes pitch-bubble-in { from { transform: translateY(8px) scale(.97); opacity: 0; } }

.pitch-panel-wrap { border-top: 3px solid var(--p-ink); background: var(--p-cream2); padding: 14px 18px 16px; max-height: 60%; overflow-y: auto; }
.pitch-overlay.is-busy .pitch-panel-wrap { pointer-events: none; }
.pitch-overlay.is-busy .pitch-panel-wrap > * { opacity: .6; transition: opacity .2s; }
.pitch-panel-title { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 18px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.pitch-panel-note { font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: var(--p-ink2); }
.pitch-choices { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pitch-choices-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pitch-choice { position: relative; text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px 10px 14px; background: var(--p-card); border: var(--p-out); border-radius: 16px; box-shadow: 0 4px 0 var(--p-ink); cursor: pointer; font: inherit; color: inherit; transition: transform .08s, box-shadow .08s, background .15s; touch-action: manipulation; min-height: 64px; }
.pitch-choice:hover { background: #fffbe8; transform: translateY(-1px); box-shadow: 0 5px 0 var(--p-ink); }
.pitch-choice:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--p-ink); }
.pitch-choice.is-disabled { opacity: .55; cursor: not-allowed; background: #f3ecd8; box-shadow: 0 2px 0 var(--p-ink); transform: none; }
.pitch-choice-label { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 17px; line-height: 1.1; padding-right: 26px; }
.pitch-choice-hint { font-size: 12px; font-weight: 800; color: var(--p-grass-d); }
.pitch-choice.is-disabled .pitch-choice-hint { color: var(--p-red); }
.pitch-choice-line { font-size: 13px; color: var(--p-ink2); font-style: italic; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pitch-key { position: absolute; right: 9px; top: 9px; width: 22px; height: 22px; border-radius: 7px; background: var(--p-ink); color: var(--p-cream); font: 900 12px 'Nunito', sans-serif; display: grid; place-items: center; }
.pitch-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 12px; }
.pitch-actions .pitch-btn-ghost:first-child { margin-right: auto; }
.pitch-chip { display: inline-flex; align-items: center; gap: 4px; font: 800 13px 'Nunito', sans-serif; padding: 4px 10px; border-radius: 999px; border: 2px solid var(--p-ink); background: var(--p-card); white-space: nowrap; }
.pitch-chip-counter { background: var(--p-sun); font-size: 15px; animation: pitch-hop .5s ease-out; }
.pitch-room-pleased, .pitch-room-accept { background: #c9ecae; }
.pitch-room-close { background: #fff0a8; }
.pitch-room-steep { background: #ffd2a8; }
.pitch-room-offended { background: #ffb3a6; }

.pitch-offer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; align-items: center; }
.pitch-freq { display: flex; border: var(--p-out); border-radius: 14px; overflow: hidden; background: var(--p-card); grid-column: 1 / -1; justify-self: start; }
.pitch-seg { font: 800 14px 'Nunito', sans-serif; padding: 9px 16px; background: transparent; border: 0; cursor: pointer; color: var(--p-ink); min-height: 40px; }
.pitch-seg + .pitch-seg { border-left: 3px solid var(--p-ink); }
.pitch-seg.is-on { background: var(--p-grass); color: #fff; }
.pitch-stepper { display: flex; align-items: center; gap: 6px; }
.pitch-step { width: 44px; height: 44px; border-radius: 12px; border: var(--p-out); background: var(--p-card); font: 900 15px 'Nunito', sans-serif; cursor: pointer; box-shadow: 0 3px 0 var(--p-ink); color: var(--p-ink); touch-action: manipulation; flex: none; }
.pitch-step:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--p-ink); }
.pitch-price { flex: 1; min-width: 96px; text-align: center; background: #fff; border: var(--p-out); border-radius: 14px; padding: 2px 6px 4px; }
.pitch-price-val { display: block; font: 800 30px/1.05 'Baloo 2', sans-serif; }
.pitch-price-unit { display: block; font-size: 11px; font-weight: 800; color: var(--p-ink2); }
.pitch-slider { width: 100%; accent-color: var(--p-grass); height: 30px; }
.pitch-addons { display: flex; flex-wrap: wrap; gap: 8px; grid-column: 1 / -1; }
.pitch-addon { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px 6px 8px; border: 2.5px solid var(--p-ink); border-radius: 999px; background: var(--p-card); font-weight: 800; font-size: 14px; cursor: pointer; }
.pitch-addon input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.pitch-addon-box { width: 20px; height: 20px; border-radius: 6px; border: 2.5px solid var(--p-ink); background: #fff; display: grid; place-items: center; }
.pitch-addon.is-on { background: #dcf2c6; }
.pitch-addon.is-on .pitch-addon-box { background: var(--p-grass); }
.pitch-addon.is-on .pitch-addon-box::after { content: ''; width: 5px; height: 10px; border: solid #fff; border-width: 0 3px 3px 0; transform: rotate(45deg) translate(-1px, -1px); }
.pitch-addon:focus-within { outline: 3px solid var(--p-sun); outline-offset: 2px; }
.pitch-addon-pct { color: var(--p-grass-d); font-size: 12px; }
.pitch-total { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 700; font-size: 15px; }
.pitch-total strong { font: 800 20px 'Baloo 2', sans-serif; }

.pitch-end { text-align: center; padding: 4px 0; position: relative; }
.pitch-stamp { display: inline-block; font: 800 38px/1 'Baloo 2', sans-serif; padding: 8px 26px; border: 5px solid currentColor; border-radius: 16px; transform: rotate(-4deg); animation: pitch-stamp .45s cubic-bezier(.2,1.6,.4,1); margin: 4px 0 12px; }
.pitch-end-good .pitch-stamp { color: var(--p-grass-d); background: #e4f6d2; }
.pitch-end-bad .pitch-stamp { color: #8a5b4f; background: #f6e4dc; }
@keyframes pitch-stamp { from { transform: rotate(-4deg) scale(2.2); opacity: 0; } }
.pitch-endrows { max-width: 420px; margin: 0 auto; display: grid; gap: 6px; }
.pitch-endrow { display: flex; justify-content: space-between; gap: 12px; background: var(--p-card); border: 2px solid var(--p-line); border-radius: 12px; padding: 7px 12px; font-size: 15px; }
.pitch-endrow span { color: var(--p-ink2); font-weight: 700; }
.pitch-endrow-dim { opacity: .8; }
.pitch-endnote { font-weight: 700; color: var(--p-ink2); font-size: 15px; padding: 4px; }
.pitch-end .pitch-actions { justify-content: center; }
.pitch-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; }
.pitch-confetti i { position: absolute; top: -12px; width: 10px; height: 14px; border-radius: 2px; animation: pitch-fall 1.6s ease-in forwards; }
@keyframes pitch-fall { to { transform: translateY(820px) rotate(540deg); opacity: .2; } }

/* ---------------------------------------------------------------- small screens */
@media (max-width: 860px) {
  .pitch-list { display: none; left: 0; right: 0; top: auto; bottom: 0; width: auto; height: min(62%, 520px); border-radius: 22px 22px 0 0; border-bottom: 0; z-index: 25; }
  .pitch-root.show-list .pitch-list { display: flex; animation: pitch-sheet .22s ease-out; }
  .pitch-listtoggle { display: inline-flex; }
  .pitch-card { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; max-height: 64%; z-index: 26; animation: pitch-sheet .22s ease-out; }
  .pitch-zoom { left: auto; right: 12px; bottom: 16px; }
  .pitch-root.has-card .pitch-zoom, .pitch-root.show-list .pitch-zoom { display: none; }
  .pitch-hint { left: 12px; right: 74px; bottom: 16px; transform: none; width: auto; max-width: none; font-size: 14px; }
  @keyframes pitch-sheet { from { transform: translateY(40px); opacity: 0; } }
}
@media (max-width: 560px) {
  .pitch-top { top: 8px; left: 8px; right: 8px; gap: 6px; flex-wrap: wrap; }
  .pitch-title { padding: 4px 10px 5px; order: 3; flex: 1 1 100%; }
  .pitch-title h1 { font-size: 19px; }
  .pitch-title p { font-size: 12px; }
  .pitch-top .pitch-spacer { display: none; }
  .pitch-clock { margin-left: auto; padding: 4px 10px 4px 6px; }
  .pitch-clock-icon { width: 28px; height: 28px; }
  .pitch-clock-time { font-size: 17px; }
  .pitch-toasts { top: 124px; }
}
@media (max-width: 760px), (max-height: 560px) {
  .pitch-overlay { padding: 0; }
  .pitch-dialog { height: 100%; width: 100%; border-radius: 0; border: 0; grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .pitch-doorside { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; align-items: stretch; border-right: 0; border-bottom: 4px solid var(--p-ink); padding: 8px 10px; gap: 6px 10px; }
  .pitch-doorframe { width: 78px; padding: 5px 5px 0; grid-row: 1 / span 2; border-radius: 10px 10px 0 0; align-self: end; }
  .pitch-doorway { height: 104px; }
  .pitch-portrait-xl .pitch-initials { font-size: 34px; }
  .pitch-porchlight, .pitch-housenum, .pitch-mat { display: none; }
  .pitch-who { margin: 0; min-width: 0; text-align: left; padding: 4px 10px; box-shadow: none; border-width: 2px; }
  .pitch-name { font-size: 19px; }
  .pitch-arch { font-size: 11px; }
  .pitch-flavor, .pitch-notes { display: none; }
  .pitch-moodrow { padding: 4px 10px; box-shadow: none; border-width: 2px; gap: 8px; }
  .pitch-facewrap { width: 40px; height: 40px; }
  .pitch-moodlabel { font-size: 15px; }
  .pitch-meter { height: 8px; margin: 3px 0; }
  .pitch-talkhead { padding: 8px 14px; }
  .pitch-address { font-size: 18px; }
  .pitch-log { padding: 10px 12px; }
  .pitch-bubble { max-width: 90%; font-size: 15px; }
  .pitch-panel-wrap { max-height: 64%; padding: 10px 12px 14px; }
  .pitch-choices, .pitch-choices-6 { grid-template-columns: 1fr 1fr; gap: 8px; }
  .pitch-choice { min-height: 54px; padding: 8px 10px; }
  .pitch-choice-line { display: none; }
  .pitch-offer { grid-template-columns: 1fr; }
  .pitch-actions { gap: 8px; margin-top: 10px; }
  .pitch-actions .pitch-btn { flex: 1 1 auto; min-height: 44px; padding: 6px 12px; }
  .pitch-actions .pitch-btn-go { order: -1; flex: 1 1 100%; }
  .pitch-actions .pitch-btn-ghost:first-child { margin-right: 0; }
  .pitch-end .pitch-actions .pitch-btn-go { flex: 0 1 60%; }
  .pitch-offer { gap: 8px; }
  .pitch-step { width: 40px; height: 40px; }
  .pitch-price-val { font-size: 26px; }
  .pitch-slider { height: 22px; }
  .pitch-addon { font-size: 12.5px; padding: 4px 9px 4px 6px; gap: 5px; }
  .pitch-addon-box { width: 17px; height: 17px; }
  .pitch-total { font-size: 14px; }
  .pitch-panel-title { font-size: 16px; margin-bottom: 6px; }
  .pitch-seg { padding: 6px 12px; min-height: 36px; }
  .pitch-endrow { padding: 5px 10px; font-size: 14px; }
  .pitch-stamp { font-size: 30px; }
}
@media (max-width: 760px) and (min-height: 700px) {
  .pitch-doorframe { width: 104px; }
  .pitch-doorway { height: 134px; }
}
@media (max-height: 560px) and (min-width: 700px) {
  .pitch-dialog { grid-template-columns: 200px 1fr; grid-template-rows: 1fr; }
  .pitch-doorside { display: flex; flex-direction: column; align-items: stretch; border-bottom: 0; border-right: 4px solid var(--p-ink); padding: 8px; gap: 6px; }
  .pitch-doorframe { width: 96px; align-self: center; }
  .pitch-doorway { height: 100px; }
  .pitch-who { text-align: center; }
  .pitch-talkhead { padding: 6px 12px; }
  .pitch-log { min-height: 60px; }
  .pitch-panel-wrap { max-height: 58%; }
  .pitch-choices, .pitch-choices-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pitch-choices-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .pitch-offer { grid-template-columns: 1fr 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .pitch-root *, .pitch-overlay * { animation: none !important; transition: none !important; }
}
`;

let injected = false;
export function ensurePitchStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.id = 'pitch-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}
