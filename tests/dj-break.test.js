import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/dj-break.js'
import cardHandler from '../api/song-card.js'
const oldFetch = globalThis.fetch, env = { ...process.env }
afterEach(() => { globalThis.fetch = oldFetch; process.env = { ...env } })
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.code = n; return this }, json(value) { this.body = value; return this } })
test('writer gets craft instructions, library notes and host bits, and remembers what aired', async () => {
  process.env.OPENAI_API_KEY = 'test-only'
  process.env.VOICE_PROVIDER = 'elevenlabs'
  let request, bitId
  globalThis.fetch = async (_, options) => {
    request = JSON.parse(options.body)
    const input = JSON.parse(request.input)
    bitId = input.patter.material.find((item) => item.type === 'bit').id
    return new Response(JSON.stringify({ output_text: JSON.stringify({ kind: 'songTalk', title: 'Song', tease: '', showNote: '  The corner booth is betting on rain.  ', usedMaterialIds: ['miles-so-what:release', bitId, 'made-up'], segments: [{ speaker: 'dj', text: '[excited] Fifty-nine, Columbia, 30th Street. **Miles** counted this one off. [warm] Stay a while.' }] }) }))
  }
  const body = { kind: 'songTalk', dj: { id: 'dex-monroe', name: 'Dex' }, nextTrack: { artist: 'Miles Davis', title: 'So What', facts: ['Cut in two sessions.'], djNotes: 'Opens side one.' }, recentScripts: ['Evening. That was Ella, and here is Nat.'], continuity: { usedFactIds: ['miles-so-what:opener'], airedCount: 2 } }
  const res = response(); await handler({ method: 'POST', body }, res)
  assert.equal(res.code, 200); assert.equal(request.model, 'gpt-5.4-mini')
  assert.match(request.instructions, /HOW A REAL JOCK SOUNDS/); assert.match(request.instructions, /Never hype/)
  assert.match(request.instructions, /Shape of this break/); assert.match(request.instructions, /words total/)
  const input = JSON.parse(request.input)
  assert.deepEqual(input.nextTrack.facts, ['Cut in two sessions.']); assert.equal(input.nextTrack.djNotes, 'Opens side one.')
  assert.deepEqual(input.avoidOpeners, ['Evening. That was Ella, and'])
  assert(input.patter.material.some((item) => item.type === 'library'))
  assert(!input.patter.material.some((item) => item.id === 'miles-so-what:opener'))
  // The writer's own knowledge airs untouched; only delivery tags and markdown are tidied.
  assert.match(res.body.script, /Fifty-nine, Columbia, 30th Street\. Miles counted/)
  assert(!res.body.script.includes('[excited]')); assert(res.body.script.includes('[warm]'))
  assert.deepEqual(res.body.usedFactIds, ['miles-so-what:release']); assert.deepEqual(res.body.usedAnecdoteIds, [bitId])
  assert.equal(res.body.showNote, 'The corner booth is betting on rain.')
  assert.equal(res.body.evidence.length, 1); assert.equal(res.body.writerModel, 'gpt-5.4-mini'); assert(res.body.broadcastId)
})
test('an unavailable OPENAI_SCRIPT_MODEL falls back to the default writer', async () => {
  process.env.OPENAI_API_KEY = 'test-only'
  process.env.OPENAI_SCRIPT_MODEL = 'not-a-real-model'
  const models = []
  globalThis.fetch = async (_, options) => {
    const { model } = JSON.parse(options.body)
    models.push(model)
    if (model === 'not-a-real-model') return new Response('{"error":{"message":"model not found"}}', { status: 404 })
    return new Response(JSON.stringify({ output_text: JSON.stringify({ kind: 'songTalk', title: 'Song', tease: '', showNote: '', usedMaterialIds: [], segments: [{ speaker: 'dj', text: 'Here is one.' }] }) }))
  }
  const res = response(); await handler({ method: 'POST', body: { kind: 'songTalk', dj: { name: 'Custom' }, nextTrack: { artist: 'A', title: 'B' } } }, res)
  assert.deepEqual(models, ['not-a-real-model', 'gpt-5.4-mini'])
  assert.equal(res.body.source, 'openai'); assert.equal(res.body.writerModel, 'gpt-5.4-mini')
})
test('unknown music produces no claimed research and does not trigger external lookup', () => {
  const res = response()
  cardHandler({ method: 'GET', query: { artist: 'Unknown', title: 'Untitled' } }, res)
  assert.deepEqual(res.body, { card: null, coverage: 'no-reviewed-card' })
  assert.match(res.headers['Cache-Control'], /s-maxage/)
})
