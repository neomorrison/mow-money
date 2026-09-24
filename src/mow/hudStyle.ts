// Scoped styles for the mowing job overlay. Palette mirrors src/styles/tokens.css ("suburban summer")
// so the job looks like the rest of the game even when it runs alone in the harness.
export const HUD_CSS = `
.mmj{position:absolute;inset:0;overflow:hidden;font-family:'Nunito',system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c3a24;
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;background:#9fc6e0;overscroll-behavior:none}
.mmj canvas.mmj-gl{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
.mmj-b,.mmj-prompt{touch-action:manipulation}
.mmj-modal{touch-action:pan-y}
.mmj-ui{position:absolute;inset:0;pointer-events:none;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
.mmj-ui > *{pointer-events:auto}
.mmj-card{background:rgba(255,250,240,.93);border-radius:18px;box-shadow:0 6px 18px rgba(28,58,36,.18),0 1px 0 rgba(255,255,255,.8) inset;border:1px solid rgba(28,58,36,.1);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.mmj-disp{font-family:'Baloo 2','Nunito',system-ui,sans-serif}
.mmj-client{position:absolute;top:inherit;left:inherit;display:flex;gap:10px;align-items:center;padding:8px 14px 8px 8px;max-width:min(360px,44vw)}
.mmj-client{top:max(10px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left))}
.mmj-av{width:44px;height:44px;border-radius:50%;flex:none;background:#cdeab9;display:grid;place-items:center;font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:800;color:#245a31;font-size:18px;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.mmj-av img{width:100%;height:100%;object-fit:cover}
.mmj-client b{display:block;font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:700;font-size:17px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mmj-client span{display:block;font-size:13px;color:#4b6552;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mmj-clock{position:absolute;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 16px 6px 10px;white-space:nowrap}
.mmj-clock .t{font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:800;font-size:22px;line-height:1}
.mmj-clock .w{font-size:13px;color:#4b6552;font-weight:700}
.mmj-clock svg{width:26px;height:26px}
.mmj-clock.late{background:rgba(255,235,214,.95)}
.mmj-clock.late .t{color:#c0561e}
/* quality card and minimap stack in one column so a taller card can never cover the map */
.mmj-ui > .mmj-right{position:absolute;top:max(10px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));width:188px;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.mmj-right > *{pointer-events:auto}
.mmj-q{padding:10px 12px}
.mmj-q .row{display:flex;align-items:center;justify-content:space-between;gap:6px}
.mmj-q .side{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.mmj-track{font-size:11px;font-weight:800;color:#5c7a44;white-space:nowrap}
.mmj-track:empty{display:none}
.mmj-q .big{font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:800;font-size:34px;line-height:.9}
.mmj-q .lbl{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c917f}
.mmj-stars{display:flex;gap:1px}
.mmj-stars svg{width:17px;height:17px}
.mmj-bars{margin-top:8px;display:grid;gap:5px}
.mmj-bar{display:grid;grid-template-columns:62px 1fr 34px;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#4b6552}
.mmj-bar i{display:block;height:7px;border-radius:5px;background:#e7f5dc;overflow:hidden;position:relative}
.mmj-bar i u{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#4fa556,#74bf68);border-radius:5px;transition:width .3s}
.mmj-bar em{font-style:normal;text-align:right;color:#1c3a24}
.mmj-mini{padding:6px}
.mmj-mini canvas{display:block;width:100%;border-radius:12px;image-rendering:auto}
.mmj-status{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));padding:10px 14px;min-width:230px;display:grid;gap:6px}
.mmj-status .tool{display:flex;align-items:center;gap:8px;font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:700;font-size:17px}
.mmj-status .tool svg{width:24px;height:24px;color:#2f6f3a}
.mmj-status .kv{display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#4b6552;gap:10px}
.mmj-status .kv b{color:#1c3a24}
.mmj-status .kv b.warn{color:#c0561e}
.mmj-status .kv b.ok{color:#2f6f3a}
.mmj-meter{height:8px;border-radius:5px;background:#f3e6c8;overflow:hidden}
.mmj-meter u{display:block;height:100%;border-radius:5px;background:#ffc12e;transition:width .25s}
.mmj-meter.full u{background:#d9483b}
.mmj-btns{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.mmj-btnrow{display:flex;gap:8px}
.mmj-b{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:800;color:#1c3a24;background:rgba(255,250,240,.95);border-radius:16px;min-width:52px;height:52px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  box-shadow:0 4px 0 rgba(28,58,36,.18),0 6px 14px rgba(28,58,36,.16);border:1px solid rgba(28,58,36,.12);transition:transform .08s, background .15s}
.mmj-b:focus{outline:none}
.mmj-b:focus-visible{outline:3px solid #ffc12e;outline-offset:2px}
.mmj-b:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(28,58,36,.18),0 3px 8px rgba(28,58,36,.14)}
.mmj-b svg{width:24px;height:24px}
.mmj-b .k{font-size:11px;color:#7c917f;font-weight:800}
.mmj-b.on{background:#ffd35c;border-color:#e6a100}
.mmj-b.go{background:#4fa556;color:#fff;border-color:#2f6f3a}
.mmj-b.go .k{color:#e7f5dc}
.mmj-b[disabled]{opacity:.4;cursor:default}
.mmj-b.sm{height:44px;min-width:44px;padding:0 10px;border-radius:14px}
.mmj-hint{position:absolute;left:50%;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 4px);transform:translateX(-50%);padding:10px 18px;font-weight:800;font-size:15px;max-width:min(520px,60vw);text-align:center;display:none}
.mmj-hint.show{display:block;animation:mmjHint .3s ease}
.mmj-hint small{display:block;font-weight:700;color:#7c917f;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px}
.mmj-prompt{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);padding:10px 18px;font-weight:800;display:none;align-items:center;gap:10px}
.mmj-prompt.show{display:flex}
.mmj-toasts{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 58px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.mmj-toast{padding:7px 14px;border-radius:14px;font-weight:800;font-size:14px;background:rgba(255,250,240,.96);box-shadow:0 4px 14px rgba(28,58,36,.18);animation:mmjIn .25s ease, mmjOut .4s ease 2.4s forwards;white-space:nowrap}
.mmj-toast.bad{background:#fde4df;color:#a1301f}
.mmj-toast.good{background:#e7f5dc;color:#245a31}
.mmj-toast.warn{background:#fdebd6;color:#9a5212}
@keyframes mmjIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes mmjOut{to{opacity:0;transform:translateY(-6px)}}
@keyframes mmjHint{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
.mmj-hint.show{transform:translateX(-50%)}
.mmj-joy{position:absolute;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;background:rgba(255,250,240,.28);border:2px solid rgba(255,255,255,.7);display:none;pointer-events:none}
.mmj-joy i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,250,240,.92);box-shadow:0 4px 12px rgba(0,0,0,.2)}
.mmj-joyhint{position:absolute;left:max(24px,env(safe-area-inset-left));bottom:calc(max(10px,env(safe-area-inset-bottom)) + 150px);width:110px;height:110px;border-radius:50%;border:2px dashed rgba(255,255,255,.75);display:none;place-items:center;color:#fff;font-weight:800;font-size:12px;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.4);pointer-events:none}
.mmj.touch .mmj-joyhint{display:grid}
.mmj-modal{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(18,50,27,.35);padding:16px;pointer-events:auto;z-index:5}
.mmj-modal.show{display:flex;animation:mmjIn .2s ease}
.mmj-sheet{background:#fffaf0;border-radius:26px;box-shadow:0 20px 60px rgba(18,50,27,.35);width:min(560px,100%);max-height:100%;overflow:auto;padding:22px 24px;position:relative}
.mmj-sheet h2{margin:0;font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:800;font-size:28px;line-height:1.05}
.mmj-sheet h3{margin:16px 0 6px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c917f}
.mmj-sheet p{margin:6px 0;color:#4b6552;font-weight:600}
.mmj-sub{color:#4b6552;font-weight:700;margin-top:2px}
.mmj-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.mmj-fact{background:#f3faec;border-radius:14px;padding:8px 10px}
.mmj-fact small{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7c917f}
.mmj-fact b{font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-size:18px;font-weight:700}
.mmj-notes{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.mmj-notes li{background:#fff5d6;border-radius:12px;padding:8px 12px;font-weight:700;color:#5b4a1a}
.mmj-keys{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px;font-weight:600;color:#4b6552}
.mmj-keys kbd{font-family:inherit;font-weight:800;color:#1c3a24;background:#f3e6c8;border-radius:7px;padding:1px 7px;font-size:12px;white-space:nowrap}
.mmj-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
.mmj-actions .mmj-b{height:54px;padding:0 22px;font-size:17px}
.mmj-actions .mmj-b.big{min-width:170px}
.mmj-yellow{background:#ffc12e !important;border-color:#e6a100 !important}
.mmj-menu{display:grid;gap:10px;margin-top:16px}
.mmj-menu .mmj-b{width:100%;height:56px;font-size:18px}
.mmj-loading{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(#bfe0f2,#e8f4d8);font-family:'Baloo 2','Nunito',system-ui,sans-serif;font-weight:800;font-size:22px;color:#245a31;z-index:4;transition:opacity .4s}
.mmj-loading.gone{opacity:0;pointer-events:none}
.mmj-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .15s}
.mmj-heat{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 20%,rgba(255,214,150,0),rgba(255,190,110,.18))}
/* compact layout for phones and small tablets */
.mmj.compact .mmj-client{max-width:44vw;padding:6px 10px 6px 6px}
.mmj.compact .mmj-av{width:34px;height:34px;font-size:14px}
.mmj.compact .mmj-client b{font-size:14px}
.mmj.compact .mmj-client span{display:none}
.mmj.compact .mmj-clock{top:calc(max(10px,env(safe-area-inset-top)) + 52px);left:max(12px,env(safe-area-inset-left));transform:none;padding:4px 10px 4px 6px}
.mmj.compact .mmj-clock .t{font-size:17px}
.mmj.compact .mmj-clock svg{width:20px;height:20px}
.mmj.compact .mmj-right{width:128px;gap:6px}
.mmj.compact .mmj-q{padding:8px 10px}
.mmj.compact .mmj-q .row{flex-wrap:wrap;row-gap:2px}
.mmj.compact .mmj-q .side{align-items:flex-start}
.mmj.compact .mmj-track{font-size:10px}
.mmj.compact .mmj-q .big{font-size:26px}
.mmj.compact .mmj-stars svg{width:12px;height:12px}
.mmj.compact .mmj-bars{display:none}

.mmj.compact .mmj-status{top:calc(max(10px,env(safe-area-inset-top)) + 92px);bottom:auto;min-width:0;padding:7px 10px;gap:4px;width:150px}
.mmj.compact .mmj-status .tool{font-size:14px}
.mmj.compact .mmj-status .kv{font-size:11px}
.mmj.compact .mmj-toasts{top:calc(max(10px,env(safe-area-inset-top)) + 96px)}
.mmj.compact .mmj-toast{font-size:12px;white-space:normal;max-width:70vw;text-align:center}
.mmj.compact .mmj-hint{max-width:92vw;width:max-content;font-size:13px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 190px)}
.mmj.compact .mmj-joyhint{bottom:calc(max(10px,env(safe-area-inset-bottom)) + 30px);width:96px;height:96px}
.mmj.compact .mmj-facts{grid-template-columns:repeat(2,1fr)}
.mmj.compact .mmj-sheet{padding:18px}
.mmj.compact .mmj-sheet h2{font-size:23px}
.mmj.touch .mmj-status{left:max(12px,env(safe-area-inset-left))}
.mmj.touch:not(.compact) .mmj-status{bottom:auto;top:calc(max(10px,env(safe-area-inset-top)) + 70px)}
.mmj.touch .mmj-hint{bottom:calc(max(10px,env(safe-area-inset-bottom)) + 12px)}
.mmj.touch.compact .mmj-hint{bottom:calc(max(10px,env(safe-area-inset-bottom)) + 190px)}
/* short landscape phones: no minimap, hints at the top */
.mmj.short .mmj-mini{display:none}
.mmj.short .mmj-hint,.mmj.short.touch.compact .mmj-hint{bottom:auto;top:max(10px,env(safe-area-inset-top));max-width:46vw}
.mmj.short .mmj-toasts{top:calc(max(10px,env(safe-area-inset-top)) + 64px)}
.mmj.short .mmj-status .kv:nth-child(3){display:none}
`;
