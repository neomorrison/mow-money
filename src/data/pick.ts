// Line picking that avoids repeats. Dialogue pools are large; this keeps the last few dozen lines out of
// rotation so the same joke does not come up twice in a row. Cosmetic only: it never changes an outcome,
// but it does advance the rng like a normal pick, a few extra times at most.
const RECENT_MAX = 60;
const recent: string[] = [];
const recentSet = new Set<string>();

function remember(line: string): void {
  recent.push(line);
  recentSet.add(line);
  while (recent.length > RECENT_MAX) {
    const old = recent.shift()!;
    if (!recent.includes(old)) recentSet.delete(old);
  }
}

/** Pick a line from `pool`, skipping lines shown recently when the pool allows it. */
export function pickFresh(rng: { pick<T>(a: readonly T[]): T }, pool: readonly string[]): string {
  if (!pool.length) return '';
  const fresh = pool.filter((l) => !recentSet.has(l));
  const line = rng.pick(fresh.length ? fresh : pool);
  remember(line);
  return line;
}

/** Forget remembered lines (tests). */
export function resetRecentLines(): void {
  recent.length = 0;
  recentSet.clear();
}
