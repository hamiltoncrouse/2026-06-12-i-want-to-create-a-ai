import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookupSongCard, songCards } from '../lib/song-cards.js'
import { preparePatter, compilePatter } from '../lib/patter-editor.js'
import { availableAnecdotes } from '../lib/persona-canon.js'
const track = { artist: 'The Beatles', title: 'Eleanor Rigby', metadataConfidence: 'high' }
const body = { kind: 'songTalk', dj: { id: 'dex-monroe' }, nextTrack: track }
const plan = (text) => ({ segments: [{ speaker: 'dj', text }] })
test('song identity never fuzzy matches covers or unknown versions to recording details', () => {
  assert.equal(songCards.length, 8)
  assert.equal(lookupSongCard({ ...track, artist: 'Someone Else' }), null)
  assert.equal(lookupSongCard({ ...track, title: 'Eleanor Rigby (Live)' }), null)
  assert.equal(lookupSongCard({ ...track, metadataConfidence: 'low' }), null)
  assert.deepEqual(lookupSongCard(track).listeningCues, [])
  assert.equal(lookupSongCard({ ...track, album: 'Revolver', version: 'original studio recording' }).listeningCues.length, 1)
  assert.equal(lookupSongCard({ ...track, album: 'Revolver', version: 'original studio recording', liveShow: { venue: 'Test' } }).listeningCues.length, 0)
})
test('only approved references expand; unsupported factual prose gets rejected', () => {
  const prepared = preparePatter(body)
  const id = prepared.material[0].id
  const out = compilePatter(plan(`It won five Grammys in 1972. {{fact:${id}}} {{fact:made-up}}`), body, prepared)
  assert(!out.script.includes('1972')); assert(!out.script.includes('Grammys'))
  assert(out.script.includes(prepared.material[0].text)); assert.equal(out.evidence.length, 1)
  assert(out.qualityIssues.includes('unsupported-claim'))
})
test('used facts and anecdotes are avoided on later/new shows; no research is invented', () => {
  const first = preparePatter(body).material[0]
  const next = preparePatter({ ...body, continuity: { usedFactIds: [first.id] } })
  assert.notEqual(next.material[0].id, first.id)
  const noFacts = preparePatter({ ...body, nextTrack: { artist: 'Unknown', title: 'Unknown' } })
  assert.equal(noFacts.card, null); assert.equal(noFacts.material[0].type, 'life')
  const allLife = ['dex-monroe:life-1', 'dex-monroe:life-2', 'dex-monroe:life-3']
  assert.deepEqual(preparePatter({ ...body, nextTrack: {}, continuity: { usedAnecdoteIds: allLife } }).material, [])
  assert.deepEqual(availableAnecdotes('johnny-london'), []); assert.deepEqual(availableAnecdotes('sir-paul'), [])
})
test('approved personal line is exact and not repeated or embellished', () => {
  const prepared = preparePatter({ ...body, continuity: { airedCount: 1 } })
  const item = prepared.material[0]
  const out = compilePatter(plan(`My sister taught Miles piano. {{life:${item.id}}} {{life:${item.id}}}`), body, prepared)
  assert(!out.script.includes('sister')); assert.equal(out.usedAnecdoteIds.length, 1)
  assert(out.script.includes(item.text))
})

test('fictional callbacks require a previous aired chapter, never an invented listener memory', () => {
  assert(!availableAnecdotes('dex-monroe').some((item) => item.id.endsWith('life-3')))
  assert(availableAnecdotes('dex-monroe', ['dex-monroe:life-1']).some((item) => item.id.endsWith('life-3')))
})
