// Command registry powering the Cmd+K palette. The shell registers global
// commands; each editor registers its own while mounted and clears them on
// unmount, so the palette always reflects what's actually available.

export interface Command {
  id: string
  title: string
  group: string
  /** Right-aligned hint, usually a shortcut. */
  hint?: string
  /** Extra words to match against when searching. */
  keywords?: string
  run: () => void | Promise<void>
}

type Scope = string

const scopes = new Map<Scope, Command[]>()
const listeners = new Set<() => void>()

export function registerCommands(scope: Scope, commands: Command[]): void {
  scopes.set(scope, commands)
  listeners.forEach((cb) => cb())
}

export function clearCommands(scope: Scope): void {
  if (scopes.delete(scope)) listeners.forEach((cb) => cb())
}

export function getCommands(): Command[] {
  return [...scopes.values()].flat()
}

export function subscribeCommands(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * Subsequence fuzzy match ("nd" matches "New document"). Returns a score where
 * higher is better, or -1 for no match. Word-start hits rank above mid-word.
 */
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 0
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h === n) return 1000
  const direct = h.indexOf(n)
  if (direct === 0) return 900
  if (direct > 0) return 700 - direct

  let score = 0
  let hi = 0
  for (const ch of n) {
    const found = h.indexOf(ch, hi)
    if (found === -1) return -1
    // Reward matches that start a word.
    score += found === 0 || h[found - 1] === ' ' || h[found - 1] === '-' ? 12 : 4
    score -= Math.min(found - hi, 6)
    hi = found + 1
  }
  return score
}

export function searchCommands(commands: Command[], query: string): Command[] {
  const q = query.trim()
  if (!q) return commands
  return commands
    .map((c) => ({ c, s: fuzzyScore(`${c.title} ${c.group} ${c.keywords ?? ''}`, q) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
}
