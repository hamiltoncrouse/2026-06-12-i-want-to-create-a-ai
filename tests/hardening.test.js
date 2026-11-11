import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isPublicHttpUrl, fetchPublicText } from '../lib/safe-fetch.js'
import { decodeEntities, extractRssTitles } from '../api/context.js'
import libraryHandler from '../api/library.js'
import musicHandler from '../api/music.js'
import voicesHandler from '../api/voices.js'
import voiceHandler from '../api/voice.js'

const oldFetch = globalThis.fetch, env = { ...process.env }
afterEach(() => { globalThis.fetch = oldFetch; process.env = { ...env } })
const response = () => ({
  headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.code = n; return this },
  json(value) { this.body = value; return this }, send(value) { this.body = value; return this }, end() { return this },
})

test('library sources must be public http(s) addresses', () => {
  for (const ok of ['https://mwalk.neocities.org/music/manifest.json', 'http://example.com/tunes/']) {
    assert.equal(isPublicHttpUrl(ok), true, ok)
  }
  for (const bad of [
    'file:///etc/passwd', 'ftp://example.com/a.mp3', 'http://localhost:3000/', 'http://127.0.0.1/', 'http://2130706433/',
    'http://0x7f.1/', 'http://10.1.2.3/', 'http://172.20.0.1/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/', 'http://user:pw@example.com/', 'http://intranet/', 'http://db.internal/', 'not a url', '',
  ]) assert.equal(isPublicHttpUrl(bad), false, bad)
})

test('library fetch screens every redirect hop', async () => {
  const seen = []
  globalThis.fetch = async (url) => {
    seen.push(url)
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
  }
  await assert.rejects(fetchPublicText('https://example.com/manifest.json'), /not allowed/)
  assert.deepEqual(seen, ['https://example.com/manifest.json'])
})

test('library scan refuses private hosts and survives messy manifests', async () => {
  let res = response()
  await libraryHandler({ query: { url: 'http://169.254.169.254/latest/' } }, res)
  assert.equal(res.code, 400)

  globalThis.fetch = async () => new Response(JSON.stringify({ tracks: [
    null, 42, { file: 7 }, 'Artist - 100% Pure.mp3', { title: 'Named', artist: 'Someone', file: 'sub/named.mp3' },
  ] }), { headers: { 'content-type': 'text/plain' } })
  res = response()
  await libraryHandler({ query: { url: 'https://example.com/music/list.json?v=2' } }, res)
  assert.equal(res.code, 200)
  assert.deepEqual(res.body.tracks.map(({ title, artist, url }) => ({ title, artist, url })), [
    { title: '100% Pure', artist: 'Artist', url: 'https://example.com/music/Artist%20-%20100%%20Pure.mp3' },
    { title: 'Named', artist: 'Someone', url: 'https://example.com/music/sub/named.mp3' },
  ])
})

test('headlines are decoded for speech', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry&#39;s &quot;big&quot; day &#x2014; live'), 'Tom & Jerry\'s "big" day — live')
  const xml = '<title>Top stories - Google News</title><item><title>Mayor&amp;#39;s plan &amp;amp; budget</title></item><item><title><![CDATA[Rain &amp; wind]]></title></item>'
  assert.deepEqual(extractRssTitles(xml, 5), ["Mayor's plan & budget", 'Rain & wind'])
})

test('paid operator tools stay off without the admin token', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-only'
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return new Response('{}') }

  let res = response()
  await musicHandler({ method: 'POST', headers: {}, query: {}, body: { prompt: 'a jingle' } }, res)
  assert.equal(res.code, 403)
  res = response()
  await voicesHandler({ headers: {}, query: { probe: 'abc' } }, res)
  assert.equal(res.code, 403)
  process.env.AIRBREAK_ADMIN_TOKEN = 'letmein'
  res = response()
  await voicesHandler({ headers: { 'x-admin-token': 'wrong!!' }, query: { probe: 'abc' } }, res)
  assert.equal(res.code, 403)
  assert.equal(calls, 0)

  res = response()
  await voicesHandler({ headers: { 'x-admin-token': 'letmein' }, query: { detail: 'abc' } }, res)
  assert.equal(res.code, 200)
  assert.equal(calls, 1)
})

test('an ElevenLabs network failure still falls back to OpenAI', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-only'
  process.env.OPENAI_API_KEY = 'test-only'
  process.env.VOICE_PROVIDER = 'elevenlabs'
  globalThis.fetch = async (url) => {
    if (String(url).includes('elevenlabs')) throw new TypeError('fetch failed')
    return new Response(new Uint8Array([1, 2, 3]))
  }
  const res = response()
  await voiceHandler({ method: 'POST', body: { text: 'Hello there', voice: 'marin', speaker: 'dj' } }, res)
  assert.equal(res.code, 200)
  assert.equal(res.headers['X-Voice-Provider'], 'openai-fallback')
})

test('file names split into artist and title, ignoring track numbers', async () => {
  globalThis.fetch = async () => new Response(
    '<a href="Miles%20Davis%20-%20So%20What.mp3">x</a><a href="16%20-%20We_Will_Rock_You.mp3">y</a><a href="Amor%20Total.mp3">z</a><a href="notes.txt">n</a>',
    { headers: { 'content-type': 'text/html' } },
  )
  const res = response()
  await libraryHandler({ query: { url: 'https://example.com/music/' } }, res)
  assert.deepEqual(res.body.tracks.map(({ title, artist }) => [artist, title]), [
    ['Miles Davis', 'So What'], ['Unknown Artist', 'We Will Rock You'], ['Unknown Artist', 'Amor Total'],
  ])
})
