// Inline SVG icon set. Stroke icons use currentColor; weather icons carry their own colors.
// icon(name) returns an SVG string with the class ui-icon.

const S = (body: string) => body;

const STROKE: Record<string, string> = {
  cash: S('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>'),
  coins: S('<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.4c.5 1.3 2.8 2.1 5.5 2.1 3 0 5.5-1.1 5.5-2.5v-4c0-1.3-2.1-2.3-4.9-2.5"/><path d="M20.5 12c0 1.4-2.5 2.5-5.5 2.5"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
  mower: S('<path d="M16.5 3.5l-4.8 8.2"/><path d="M14.5 3l4 2"/><path d="M3.2 12.2h12.6a2 2 0 0 1 2 2v1.6H3.2z"/><circle cx="6.5" cy="18.3" r="2.2"/><circle cx="15.2" cy="18.3" r="2.2"/>'),
  truck: S('<path d="M2.5 6.5h11v9.5h-11z"/><path d="M13.5 9.5h4.2l3.3 3.5v3h-7.5z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>'),
  crew: S('<circle cx="9" cy="8" r="3.3"/><path d="M2.8 19.5c.6-3.4 3.1-5.5 6.2-5.5s5.6 2.1 6.2 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.6 13.7c2.6.1 4.3 2 4.7 4.8"/>'),
  user: S('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3"/>'),
  map: S('<path d="M3 6.3l6-2.3 6 2.3 6-2.3v13.7l-6 2.3-6-2.3-6 2.3z"/><path d="M9 4v13.7M15 6.3V20"/>'),
  pin: S('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  chart: S('<path d="M3.5 20.5h17"/><rect x="5" y="12" width="3" height="6" rx="1"/><rect x="10.5" y="7.5" width="3" height="10.5" rx="1"/><rect x="16" y="4" width="3" height="14" rx="1"/>'),
  trend: S('<path d="M3 17l5.5-5.5 4 4L21 7"/><path d="M15 7h6v6"/>'),
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/><circle cx="12" cy="12" r="6.6"/>'),
  leaf: S('<path d="M5 19c-1-7 3.5-13.5 15-14-.4 10.6-6.7 15.8-14 14z"/><path d="M5 19c3-4.5 6.2-7.5 10-9.5"/>'),
  grass: S('<path d="M3 20.5h18"/><path d="M5.5 20.5c0-4-1-6.5-2.5-8.5 2.8 1.2 4.2 4 4.4 8.5"/><path d="M10 20.5c0-6 .8-10.5 2.5-14 .8 4.3.6 9.3-.5 14"/><path d="M15.2 20.5c.4-3.8 1.9-7 5-9-1.8 2.6-2.6 5.5-2.8 9"/>'),
  wrench: S('<path d="M14.7 6.3a4.2 4.2 0 0 0-5.5 5.4L3.8 17.1a2 2 0 0 0 2.9 2.9l5.4-5.4a4.2 4.2 0 0 0 5.4-5.5l-2.6 2.6-2.5-.6-.6-2.5z"/>'),
  handshake: S('<path d="M2.5 11.5l3.5-4 4 1.2 2-1.2 3.2.8 3 3.2 3.3-1"/><path d="M6 7.5l-3.5 4.4 5.8 5.6c.8.8 2 .8 2.8 0l.2-.2"/><path d="M18.2 10.5l-6.4 6.6c-.8.8-2 .8-2.8 0"/><path d="M12 8.5l-2.8 2.9c-.6.6-.4 1.6.4 1.9.6.3 1.3.1 1.8-.3l2.2-1.8"/>'),
  trophy: S('<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.8 10.5M16.5 6h3v1.5a3 3 0 0 1-3.3 3"/><path d="M12 13.5v3.5M8.5 20h7M9.5 17h5v3h-5z"/>'),
  door: S('<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21"/><path d="M3 21h18"/><circle cx="15.3" cy="12.5" r="1" fill="currentColor"/>'),
  calendar: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  home: S('<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>'),
  house: S('<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><rect x="9" y="12.5" width="6" height="4" rx=".5"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  minus: S('<path d="M5 12h14"/>'),
  x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: S('<path d="M4.5 12.5l4.8 4.8L19.5 7"/>'),
  chevR: S('<path d="M9 5l7 7-7 7"/>'),
  chevL: S('<path d="M15 5l-7 7 7 7"/>'),
  chevD: S('<path d="M5 9l7 7 7-7"/>'),
  arrowR: S('<path d="M4 12h15M13 6l6 6-6 6"/>'),
  arrowUp: S('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  arrowDown: S('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  alert: S('<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".6" fill="currentColor"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>'),
  lock: S('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  unlock: S('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.5"/>'),
  sparkle: S('<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/><path d="M19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z"/>'),
  fuel: S('<path d="M4.5 20.5V5.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M3 20.5h13"/><path d="M7 7.5h5"/><path d="M14.5 10h2a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 0 3 0V8l-3-3"/>'),
  bolt: S('<path d="M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z"/>'),
  scissors: S('<circle cx="6" cy="7" r="2.8"/><circle cx="6" cy="17" r="2.8"/><path d="M8.3 8.6L20 17M8.3 15.4L20 7"/>'),
  trimmer: S('<path d="M20 3.5L8 15.5"/><path d="M14.5 6l3 3"/><path d="M8 15.5l-2.2 2.2"/><circle cx="5" cy="18.5" r="2.5"/><path d="M2.5 21.5l1-1M7.5 21.5l-1-1"/>'),
  blower: S('<path d="M4 9.5a4.5 4.5 0 0 1 9 0v3a4.5 4.5 0 0 1-9 0z"/><path d="M12.5 11h8"/><path d="M15.5 7.5c1.8 0 3 .7 4 1.5M15.5 14.5c1.8 0 3-.7 4-1.5"/><path d="M8.5 5V3"/>'),
  addon: S('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M17 13.5v7M13.5 17h7"/>'),
  shield: S('<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  megaphone: S('<path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2l8 4.5V4L7 8.5H5A1.5 1.5 0 0 0 3.5 10z"/><path d="M19 9.5a3.5 3.5 0 0 1 0 5"/><path d="M7.5 15.5l1 4.5"/>'),
  gavel: S('<path d="M13.5 3.5l6.5 6.5"/><path d="M11 6l6.5 6.5"/><path d="M12.2 4.8l-4 4 6.5 6.5 4-4"/><path d="M10.5 11.5l-7 7a1.4 1.4 0 0 0 2 2l7-7"/><path d="M14 20.5h7"/>'),
  bank: S('<path d="M3 9.5L12 4l9 5.5"/><path d="M4.5 9.5h15"/><path d="M6 10v7M10 10v7M14 10v7M18 10v7"/><path d="M3.5 20h17M4.5 17.5h15"/>'),
  briefcase: S('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 12.5h18"/>'),
  book: S('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  more: S('<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>'),
  menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  play: S('<path d="M7 4.5v15l12.5-7.5z"/>'),
  robot: S('<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 4.5V8"/><circle cx="12" cy="3.8" r="1.2"/><circle cx="9" cy="13" r="1.3" fill="currentColor"/><circle cx="15" cy="13" r="1.3" fill="currentColor"/><path d="M9.5 16.3h5M2.5 12v3M21.5 12v3"/>'),
  volume: S('<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  download: S('<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4 18.5v1a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1"/>'),
  upload: S('<path d="M12 16V5M7 9.5l5-5 5 5"/><path d="M4 18.5v1a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1"/>'),
  trash: S('<path d="M4 6.5h16"/><path d="M9.5 6.5V4.5h5v2"/><path d="M6 6.5l1 13.5h10l1-13.5"/><path d="M10 10.5v6M14 10.5v6"/>'),
  eye: S('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  heart: S('<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8C20 15.2 12 20 12 20z"/>'),
  smile: S('<circle cx="12" cy="12" r="9"/><path d="M8.3 14.3c1.8 2.4 5.6 2.4 7.4 0"/><circle cx="9" cy="9.8" r=".9" fill="currentColor"/><circle cx="15" cy="9.8" r=".9" fill="currentColor"/>'),
  meh: S('<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7"/><circle cx="9" cy="9.8" r=".9" fill="currentColor"/><circle cx="15" cy="9.8" r=".9" fill="currentColor"/>'),
  frown: S('<circle cx="12" cy="12" r="9"/><path d="M8.3 16.2c1.8-2.4 5.6-2.4 7.4 0"/><circle cx="9" cy="9.8" r=".9" fill="currentColor"/><circle cx="15" cy="9.8" r=".9" fill="currentColor"/>'),
  flag: S('<path d="M5 21V4"/><path d="M5 4.5h11.5l-2 4 2 4H5"/>'),
  sign: S('<rect x="3.5" y="4" width="17" height="10" rx="1.5"/><path d="M8 14v7M16 14v7"/><path d="M7.5 9h9"/>'),
  target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
  route: S('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h6.5a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>'),
  sun: S('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
  cloud: S('<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 5.8 5.8 0 0 0-11 1.2A3.4 3.4 0 0 0 7 18.5z"/>'),
  rain: S('<path d="M7 14.5h10.5a4 4 0 0 0 .5-8 5.8 5.8 0 0 0-11 1.2A3.4 3.4 0 0 0 7 14.5z"/><path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3"/>'),
  storm: S('<path d="M7 14h10.5a4 4 0 0 0 .5-8 5.8 5.8 0 0 0-11 1.2A3.4 3.4 0 0 0 7 14z"/><path d="M12.5 12.5l-2.5 4.5h3.5l-2 4.5"/>'),
  heat: S('<path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z"/><path d="M12 9v6"/><path d="M17.5 6.5h3M17.5 10h2"/>'),
  star: S('<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>'),
  level: S('<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9L9.5 8z"/>'),
  skills: S('<circle cx="12" cy="5" r="2.2"/><circle cx="5.5" cy="17" r="2.2"/><circle cx="12" cy="19" r="2.2"/><circle cx="18.5" cy="17" r="2.2"/><path d="M12 7.2v9.6M10.6 6.7L6.6 15M13.4 6.7l4 8.3"/>'),
  today: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 14.5l2.2 2.2 4.8-4.7"/>'),
  sort: S('<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5"/><path d="M13 7h8M13 12h6M13 17h4"/>'),
  filter: S('<path d="M3.5 5h17l-6.5 8v6l-4 1.5V13z"/>'),
  keyboard: S('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8"/>'),
  gamepad: S('<path d="M7 7.5h10a5 5 0 0 1 4.8 6.3l-.8 3a2.5 2.5 0 0 1-4.3 1L14.5 15.5h-5L7.3 17.8a2.5 2.5 0 0 1-4.3-1l-.8-3A5 5 0 0 1 7 7.5z"/><path d="M8 10.5v3M6.5 12h3"/><circle cx="15.5" cy="11" r=".8" fill="currentColor"/><circle cx="17.5" cy="13" r=".8" fill="currentColor"/>'),
  touch: S('<path d="M9 11.5V5a1.8 1.8 0 0 1 3.6 0v5.5"/><path d="M12.6 10.5V9.2a1.8 1.8 0 0 1 3.6 0v2"/><path d="M16.2 11.2a1.8 1.8 0 0 1 3.3 1V15c0 3.6-2.5 6-6 6h-1.2c-2.1 0-3.6-.8-4.8-2.4L4.5 15a1.8 1.8 0 0 1 2.9-2.2L9 14.5"/>'),
  paint: S('<path d="M12 3a9 9 0 0 0 0 18c1.4 0 1.9-1 1.6-2-.4-1.2.4-2.5 1.7-2.5H18a3 3 0 0 0 3-3A9.2 9.2 0 0 0 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1.2" fill="currentColor"/>'),
  dice: S('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
  bag: S('<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  stripes: S('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 3v18M13 3v18M18 3v18" opacity=".5"/>'),
  drop: S('<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>'),
  snow: S('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2"/>'),
  sunrise: S('<path d="M3 18.5h18"/><path d="M7 18.5a5 5 0 0 1 10 0"/><path d="M12 5v4M4.6 10.6l2.2 2.2M19.4 10.6l-2.2 2.2"/>'),
  moon: S('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'),
  sell: S('<path d="M3.5 12.5l8.8-8.8a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v5.3a2 2 0 0 1-.6 1.4l-8.8 8.8a2 2 0 0 1-2.8 0L3.5 15.3a2 2 0 0 1 0-2.8z"/><circle cx="16.5" cy="7.5" r="1.5"/>'),
  refresh: S('<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.5L20 15.5"/><path d="M20 20v-4.5h-4.5"/>'),
  sharpen: S('<path d="M4 20L15.5 8.5"/><path d="M13.5 6.5l4-4 4 4-4 4z"/><path d="M6 14l4 4"/>'),
  bike: S('<circle cx="6" cy="16.5" r="3.5"/><circle cx="18" cy="16.5" r="3.5"/><path d="M6 16.5l4-7.5h5.5L18 16.5M10 9L8.5 6H6.5M12.5 16.5l3-7.5"/>'),
  exit: S('<path d="M14 4.5h4.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5L5.5 12 10 7.5M5.5 12H15"/>'),
  crown: S('<path d="M3.5 8l4.5 4 4-6.5 4 6.5 4.5-4-1.8 11H5.3z"/>'),
  percent: S('<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
  box: S('<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>'),
};

// Filled/colored icons (weather, star)
const WEATHER: Record<string, string> = {
  sunny: '<circle cx="12" cy="12" r="5" fill="#ffc12e" stroke="#e39a00" stroke-width="1.2"/><g stroke="#f2a900" stroke-width="2" stroke-linecap="round"><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M5.1 18.9l1.7-1.7M17.2 6.8l1.7-1.7"/></g>',
  cloudy: '<circle cx="8.5" cy="9" r="3.6" fill="#ffc12e" stroke="#e39a00" stroke-width="1"/><path d="M7 19.5h10.5a3.8 3.8 0 0 0 .4-7.6 5.4 5.4 0 0 0-10.3.9A3.4 3.4 0 0 0 7 19.5z" fill="#fff" stroke="#8aa3b8" stroke-width="1.4" stroke-linejoin="round"/>',
  rain: '<path d="M6.5 14.5h11a3.8 3.8 0 0 0 .4-7.6 5.4 5.4 0 0 0-10.3.9 3.4 3.4 0 0 0-1.1 6.7z" fill="#e8eef4" stroke="#7d93a8" stroke-width="1.4" stroke-linejoin="round"/><g stroke="#3b8fd1" stroke-width="2" stroke-linecap="round"><path d="M8 17l-1 3M12.5 17l-1 3M17 17l-1 3"/></g>',
  storm: '<path d="M6.5 13.5h11a3.8 3.8 0 0 0 .4-7.6 5.4 5.4 0 0 0-10.3.9 3.4 3.4 0 0 0-1.1 6.7z" fill="#8e9bb0" stroke="#5c6a80" stroke-width="1.4" stroke-linejoin="round"/><path d="M12.8 12.5l-3 5h3l-1.3 4.5 4.5-6h-3l1.5-3.5z" fill="#ffc12e" stroke="#e39a00" stroke-width="1" stroke-linejoin="round"/><path d="M7.5 16.5l-.8 2.5M17.5 16.5l-.8 2.5" stroke="#3b8fd1" stroke-width="1.8" stroke-linecap="round"/>',
  heat: '<circle cx="10" cy="10" r="5" fill="#ff9b2e" stroke="#e0621a" stroke-width="1.2"/><g stroke="#f07d1f" stroke-width="2" stroke-linecap="round"><path d="M10 1.8v2M10 16.2v1.2M1.8 10h2M4.2 4.2l1.4 1.4M15.8 4.2l-1.4 1.4M4.2 15.8l1.4-1.4"/></g><g stroke="#e0621a" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M13 16.5c1-.8 2-.8 3 0s2 .8 3 0M13 20c1-.8 2-.8 3 0s2 .8 3 0"/></g>',
  winter: '<g stroke="#3b8fd1" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2"/></g>',
};

export type IconName = keyof typeof STROKE | string;

export function icon(name: IconName, cls = ''): string {
  const body = STROKE[name] ?? STROKE.info;
  return `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function weatherIcon(kind: string, cls = ''): string {
  const body = WEATHER[kind] ?? WEATHER.sunny;
  return `<svg class="ui-icon ui-wx ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

const STAR_PATH = 'M12 2.6l2.85 5.9 6.45.85-4.72 4.45 1.18 6.4L12 17.1l-5.76 3.1 1.18-6.4L2.7 9.35l6.45-.85z';
export function starSvg(cls = ''): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`;
}

export function hasIcon(name: string): boolean { return name in STROKE; }
