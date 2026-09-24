// Hash router (#/hub, #/clients, #/hood/home.maple). Works on GitHub Pages without server config.

export interface Route { screen: string; params: string[] }

type Listener = (r: Route) => void;
const listeners = new Set<Listener>();
let started = false;

export function parseHash(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  return { screen: parts[0] || 'title', params: parts.slice(1) };
}

export function routeHash(screen: string, ...params: string[]): string {
  return '#/' + [screen, ...params.map((p) => encodeURIComponent(p))].join('/');
}

export function currentRoute(): Route { return parseHash(); }

export function navigate(screen: string, ...params: string[]): void {
  const h = routeHash(screen, ...params);
  if (location.hash === h) { fire(); return; }
  location.hash = h;
}

/** Replace the current history entry (no back-button stop). */
export function replaceRoute(screen: string, ...params: string[]): void {
  const h = routeHash(screen, ...params);
  history.replaceState(null, '', h);
  fire();
}

export function onRoute(fn: Listener): () => void {
  listeners.add(fn);
  if (!started) {
    started = true;
    window.addEventListener('hashchange', fire);
  }
  return () => listeners.delete(fn);
}

function fire(): void {
  const r = parseHash();
  listeners.forEach((fn) => { try { fn(r); } catch (e) { console.error(e); } });
}
