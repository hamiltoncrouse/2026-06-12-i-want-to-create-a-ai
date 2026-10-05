import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/voice.js'
import { usesAudioTags } from '../lib/voice-config.js'
const env = { ...process.env }, fetchBefore = globalThis.fetch, warnBefore = console.warn
afterEach(() => { process.env = { ...env }; globalThis.fetch = fetchBefore; console.warn = warnBefore })
async function request(overrides = {}, fail = false) {
  process.env.ELEVENLABS_API_KEY = 'test-key'; process.env.OPENAI_API_KEY = 'test-key'
  delete process.env.VOICE_PROVIDER; delete process.env.ELEVENLABS_MODEL
  Object.assign(process.env, overrides)
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return fail && url.includes('elevenlabs') ? new Response('Unavailable', { status: 503 }) : new Response(new Uint8Array([1, 2, 3]))
  }
  console.warn = () => {}
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.code = n; return this }, send() {}, end() {}, json() {} }
  await handler({ method: 'POST', body: { text: '[excited] Welcome back! [laughing] What a song.', voice: 'ash', elevenVoiceId: 'existing-custom-voice', speaker: 'dj' } }, res)
  return { calls, res }
}
test('v4 preserves selected voice and tags using supported dialogue settings', async () => {
  const { calls, res } = await request()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/text-to-dialogue')
  assert.deepEqual(calls[0].body, { model_id: 'eleven_v4', apply_text_normalization: 'auto', inputs: [{ text: '[excited] Welcome back! [laughing] What a song.', voice_id: 'existing-custom-voice' }], settings: { stability: 0.4, similarity: 0.8 } })
  assert.equal(res.code, 200); assert.equal(res.headers['X-Voice-Provider'], 'elevenlabs'); assert.equal(res.headers['X-Voice-Model'], 'eleven_v4'); assert.equal(usesAudioTags(), true)
})
test('v4 respects existing stability and similarity overrides', async () => {
  const { calls } = await request({ ELEVENLABS_STABILITY: '0.5', ELEVENLABS_SIMILARITY: '0.9' })
  assert.deepEqual(calls[0].body.settings, { stability: 0.5, similarity: 0.9 })
})
test('legacy model override retains endpoint and settings without tags', async () => {
  const { calls } = await request({ ELEVENLABS_MODEL: 'eleven_turbo_v2_5' })
  assert.match(calls[0].url, /text-to-speech\/existing-custom-voice$/)
  assert.equal(calls[0].body.voice_settings.speed, 1.04)
  assert.equal(calls[0].body.text, 'Welcome back! What a song.'); assert.equal(usesAudioTags(), false)
})
test('OpenAI fallback strips tags and preserves voice', async () => {
  const { calls, res } = await request({}, true)
  assert.equal(calls.length, 2); assert.equal(calls[1].body.input, 'Welcome back! What a song.')
  assert.equal(calls[1].body.voice, 'ash'); assert.equal(res.headers['X-Voice-Provider'], 'openai-fallback'); assert.equal(res.headers['X-Voice-Model'], undefined)
})
test('explicit OpenAI provider disables generated tags', async () => {
  const { calls } = await request({ VOICE_PROVIDER: 'openai' })
  assert.equal(calls.length, 1); assert.match(calls[0].url, /openai/); assert.equal(usesAudioTags(), false)
})
