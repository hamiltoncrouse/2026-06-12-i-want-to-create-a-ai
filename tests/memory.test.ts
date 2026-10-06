import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStationMemory, matchesBackgroundBreak, createDjProfileChangeDetector } from '../src/stationMemory.ts'
import type { BreakPlan } from '../src/types.ts'
const plan: BreakPlan = { kind: 'songTalk', title: 'Test', script: 'Hello friend.', tease: '', source: 'openai', broadcastId: 'one', usedFactIds: ['fact-1'], usedAnecdoteIds: ['life-1'], showNote: 'An actual aired note' }
const map = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } } }
test('renewed shows and reloads retain per-DJ history, deduplicated on playback callbacks', () => {
  const storage = map(), memory = createStationMemory(() => storage)
  memory.record('dex', plan); memory.record('dex', plan)
  assert.equal(memory.read('dex').airedCount, 1)
  const reloaded = createStationMemory(() => storage)
  assert.deepEqual(reloaded.read('dex').usedFactIds, ['fact-1'])
  assert.equal(reloaded.read('rex').airedCount, 0)
  reloaded.clear('dex'); assert.equal(createStationMemory(() => storage).read('dex').airedCount, 0)
})
test('denied/corrupt storage does not break playback or session continuity', () => {
  const bad = { getItem() { throw Error('disabled') }, setItem() { throw Error('full') }, removeItem() { throw Error('disabled') } }
  const memory = createStationMemory(() => bad)
  memory.record('dex', plan); assert.equal(memory.read('dex').airedCount, 1)
  memory.clear('dex'); assert.equal(memory.read('dex').airedCount, 0)
  const corrupt = createStationMemory(() => ({ ...map(), getItem: () => '{' }))
  assert.equal(corrupt.read('dex').airedCount, 0)
})
test('background material is recorded only when playback is invoked and matches DJ/queue', () => {
  const memory = createStationMemory(() => map())
  const clip = { url: 'blob:test', plan, djId: 'dex', previousTrackId: 'old', nextTrackId: 'next' }
  assert.equal(memory.read('dex').airedCount, 0)
  assert(matchesBackgroundBreak(clip, 'dex', 'old', 'next'))
  assert(!matchesBackgroundBreak(clip, 'rex', 'old', 'next'))
  assert(!matchesBackgroundBreak(clip, 'dex', 'old', 'different'))
  memory.record(clip.djId, clip.plan)
  assert.deepEqual(memory.read('dex').showNotes, ['An actual aired note'])
  assert.deepEqual(memory.read('dex').usedAnecdoteIds, ['life-1'])
})
test('old history expires and history size stays bounded', () => {
  const storage = map(); let now = 1000
  const memory = createStationMemory(() => storage, () => now)
  for (let i = 0; i < 120; i++) memory.record('dex', { ...plan, broadcastId: `b-${i}`, usedFactIds: [`f-${i}`] })
  assert.equal(memory.read('dex').recentScripts.length, 12); assert.equal(memory.read('dex').usedFactIds.length, 100)
  now += 61 * 86400000
  assert.equal(createStationMemory(() => storage, () => now).read('dex').airedCount, 0)
})

test('progress renders retain prepared audio; actual DJ edits and switches invalidate it', () => {
  const changed = createDjProfileChangeDetector()
  const profile = { id: 'dex', voice: 'onyx', coHost: { voice: 'sage' } }
  assert(changed(profile))
  const readyBreaks = new Map([['next', Promise.resolve('custom voiced break')]])
  let backgroundUrl: string | null = 'blob:custom'
  const sync = (dj: typeof profile) => {
    if (changed(dj)) { readyBreaks.clear(); backgroundUrl = null }
  }
  // App builds fresh preset and nested override objects on ordinary renders.
  for (let frame = 0; frame < 100; frame++) sync(structuredClone(profile))
  assert.equal(readyBreaks.size, 1)
  assert.equal(backgroundUrl, 'blob:custom')
  sync({ ...profile, coHost: { voice: 'coral' } })
  assert.equal(readyBreaks.size, 0)
  assert.equal(backgroundUrl, null)
  assert(changed({ ...profile, id: 'rex' }))
})
