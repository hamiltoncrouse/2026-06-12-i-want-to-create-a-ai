import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/dj-break.js'
import cardHandler from '../api/song-card.js'
const oldFetch = globalThis.fetch, env = { ...process.env }
afterEach(() => { globalThis.fetch = oldFetch; process.env = { ...env } })
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.code = n; return this }, json(value) { this.body = value; return this } })
test('writer request and response integrate reviewed facts, persona bounds, and repeated-show memory', async () => {
  process.env.OPENAI_API_KEY = 'test-only'
  process.env.VOICE_PROVIDER = 'elevenlabs'
  let request
  globalThis.fetch = async (_, options) => {
    request = JSON.parse(options.body)
    const input = JSON.parse(request.input)
    const item = input.patter.material[0]
    return new Response(JSON.stringify({ output_text: JSON.stringify({ kind: 'songTalk', title: 'Song', tease: '', showNote: 'invented life history', segments: [{ speaker: 'dj', text: `[excited] This won a Grammy in 1988. {{${item.type}:${item.id}}} [warm] Stay a while.` }] }) }))
  }
  const body = { kind: 'songTalk', dj: { id: 'dex-monroe', name: 'Dex' }, nextTrack: { artist: 'Miles Davis', title: 'So What', facts: ['unsupported'], djNotes: 'Invented recording history' }, continuity: { usedFactIds: ['miles-so-what:opener'], airedCount: 2 } }
  const res = response(); await handler({ method: 'POST', body }, res)
  assert.equal(res.code, 200); assert.equal(request.model, 'gpt-5.4-mini')
  assert.match(request.instructions, /Never hype/); assert(!request.instructions.includes('true-sounding'))
  const input = JSON.parse(request.input)
  assert.deepEqual(input.nextTrack.facts, []); assert.equal(input.nextTrack.djNotes, undefined)
  assert.equal(res.body.usedFactIds[0], 'miles-so-what:release')
  assert(!res.body.script.includes('1988')); assert(!res.body.script.includes('[excited]'))
  assert.equal(res.body.showNote, ''); assert(res.body.broadcastId); assert.equal(res.body.evidence.length, 1)
})
test('unknown music produces no claimed research and does not trigger external lookup', () => {
  const res = response()
  cardHandler({ method: 'GET', query: { artist: 'Unknown', title: 'Untitled' } }, res)
  assert.deepEqual(res.body, { card: null, coverage: 'no-reviewed-card' })
  assert.match(res.headers['Cache-Control'], /s-maxage/)
})
