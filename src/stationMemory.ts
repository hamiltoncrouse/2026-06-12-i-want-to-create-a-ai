import type { BreakPlan } from './types'

export type StationMemory = {
  version: 1
  airedCount: number
  updatedAt: number
  recentScripts: string[]
  showNotes: string[]
  usedFactIds: string[]
  usedAnecdoteIds: string[]
  broadcastIds: string[]
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const empty = (): StationMemory => ({ version: 1, airedCount: 0, updatedAt: 0, recentScripts: [], showNotes: [], usedFactIds: [], usedAnecdoteIds: [], broadcastIds: [] })
const strings = (value: unknown, count: number, length: number) => Array.isArray(value)
  ? value.filter((x): x is string => typeof x === 'string').slice(-count).map((x) => x.slice(0, length)) : []
const unique = (items: string[], max: number) => [...new Set(items)].slice(-max)
export function createStationMemory(storage: () => StorageLike | null, now = Date.now) {
  const session = new Map<string, StationMemory>()
  const key = (id: string) => `airbreak-memory-v1:${id}`
  function read(id: string): StationMemory {
    const cached = session.get(id)
    if (cached && (!cached.updatedAt || now() - cached.updatedAt < 60 * 86400000)) return cached
    let memory = empty()
    try {
      const raw = JSON.parse(storage()?.getItem(key(id)) || 'null')
      if (raw?.version === 1 && Number.isFinite(raw.updatedAt) && now() - raw.updatedAt < 60 * 86400000) {
        memory = { version: 1, updatedAt: raw.updatedAt,
          airedCount: Number.isSafeInteger(raw.airedCount) && raw.airedCount >= 0 ? raw.airedCount : 0,
          recentScripts: strings(raw.recentScripts, 12, 1600), showNotes: strings(raw.showNotes, 8, 160),
          usedFactIds: strings(raw.usedFactIds, 100, 150), usedAnecdoteIds: strings(raw.usedAnecdoteIds, 100, 150),
          broadcastIds: strings(raw.broadcastIds, 40, 100),
        }
      }
    } catch { /* Private mode, corrupt storage or disabled storage: session memory still works. */ }
    session.set(id, memory)
    return memory
  }
  function record(id: string, plan: BreakPlan) {
    const before = read(id)
    if (!plan.broadcastId || before.broadcastIds.includes(plan.broadcastId)) return before
    const after: StationMemory = { ...before, airedCount: before.airedCount + 1, updatedAt: now(),
      recentScripts: [...before.recentScripts, plan.script.slice(0, 1600)].slice(-12),
      showNotes: plan.showNote?.trim() ? [...before.showNotes, plan.showNote.slice(0, 160)].slice(-8) : before.showNotes,
      usedFactIds: unique([...before.usedFactIds, ...(plan.usedFactIds || [])], 100),
      usedAnecdoteIds: unique([...before.usedAnecdoteIds, ...(plan.usedAnecdoteIds || [])], 100),
      broadcastIds: [...before.broadcastIds, plan.broadcastId].slice(-40),
    }
    session.set(id, after)
    try { storage()?.setItem(key(id), JSON.stringify(after)) } catch { /* Keep session copy. */ }
    return after
  }
  function clear(id: string) {
    session.set(id, empty())
    try { storage()?.removeItem(key(id)) } catch { /* Clear this session even if storage is unavailable. */ }
  }
  return { read, record, clear }
}

export type BackgroundBreak = { url: string; plan: BreakPlan; djId: string; previousTrackId: string; nextTrackId: string }
export function matchesBackgroundBreak(clip: BackgroundBreak, djId: string, previousTrackId?: string, nextTrackId?: string) {
  return clip.djId === djId && clip.previousTrackId === previousTrackId && clip.nextTrackId === nextTrackId
}

// Rendered preset profiles are fresh objects. Only a changed profile should
// invalidate expensive prepared audio; progress/status renders must retain it.
export function createDjProfileChangeDetector() {
  let previous: string | undefined
  return (profile: unknown) => {
    const current = JSON.stringify(profile)
    if (current === previous) return false
    previous = current
    return true
  }
}
