import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookupSongCard, songCards } from '../lib/song-cards.js'
import { preparePatter, compilePatter } from '../lib/patter-editor.js'
import { availableAnecdotes } from '../lib/persona-canon.js'
import { rotateBits } from '../lib/persona-bits.js'
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
test('the writer own words air as written; only used material is recorded', () => {
  const prepared = preparePatter(body)
  const fact = prepared.material.find((item) => item.type === 'fact')
  const out = compilePatter({ ...plan(`It came out in 1966, strings and all. {{fact:${fact.id}}} I remember the first time I heard it.`), usedMaterialIds: [fact.id, 'made-up'], showNote: 'Promised a Revolver side later.' }, body, prepared)
  assert.equal(out.script, 'It came out in 1966, strings and all. I remember the first time I heard it.')
  assert.deepEqual(out.usedFactIds, [fact.id]); assert.equal(out.evidence.length, 1)
  assert.equal(out.showNote, 'Promised a Revolver side later.'); assert.deepEqual(out.qualityIssues, [])
})
test('material rotates: used facts drop out, host bits come back least-recently-used', () => {
  const first = preparePatter(body).material.find((item) => item.type === 'fact')
  const next = preparePatter({ ...body, continuity: { usedFactIds: [first.id] } })
  assert(!next.material.some((item) => item.id === first.id))
  const bits = (continuity) => preparePatter({ ...body, continuity }).material.filter((item) => item.type === 'bit').map((item) => item.id)
  const all = rotateBits('dex-monroe').map((item) => item.id)
  assert.equal(bits({}).length, 2); assert.equal(new Set(bits({})).size, 2)
  // Fresh bits are offered before anything that already aired.
  for (let i = 0; i < 20; i++) assert(!bits({ usedAnecdoteIds: all.slice(0, 2) }).some((id) => all.slice(0, 2).includes(id)))
  // Once everything has aired, the ones used longest ago come back first.
  const order = [...all.slice(3), ...all.slice(0, 3)]
  for (let i = 0; i < 20; i++) assert(bits({ usedAnecdoteIds: order }).every((id) => order.slice(0, 4).includes(id)))
  const custom = preparePatter({ ...body, dj: { id: 'my-own-host' }, nextTrack: { artist: 'Unknown', title: 'Unknown', facts: ['From the library.'] } })
  assert.equal(custom.card, null); assert.deepEqual(custom.material.map((item) => item.type), ['library'])
  assert.deepEqual(preparePatter({ ...body, kind: 'bumper' }).material, [])
  assert(rotateBits('johnny-london').length >= 6); assert(rotateBits('sir-paul').length >= 6)
})

test('fictional callbacks require a previous aired chapter, never an invented listener memory', () => {
  assert(!availableAnecdotes('dex-monroe').some((item) => item.id.endsWith('life-3')))
  assert(availableAnecdotes('dex-monroe', ['dex-monroe:life-1']).some((item) => item.id.endsWith('life-3')))
})
