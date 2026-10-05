// Opt-in, bounded comparison: two fixtures x two models = four requests.
// No keys are loaded from disk, created, printed, or sent anywhere but OpenAI.
import { writeFile } from 'node:fs/promises'
import handler from '../api/dj-break.js'
import { preparePatter, compilePatter } from '../lib/patter-editor.js'
import { constrainBreakDelivery } from '../lib/character-delivery.js'

if (!process.argv.includes('--run') || !process.env.OPENAI_API_KEY || !process.env.CANDIDATE_MODEL) {
  console.error('Not run. Requires --run, an existing OPENAI_API_KEY, and an available CANDIDATE_MODEL. Maximum four generations; no audio calls.')
  process.exitCode = 1
} else {
  const realFetch = globalThis.fetch
  const headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
  const inventory = await realFetch('https://api.openai.com/v1/models', { headers, signal: AbortSignal.timeout(15000) })
  if (!inventory.ok) throw Error(`Model inventory unavailable (${inventory.status}); no generations requested.`)
  const available = new Set((await inventory.json()).data.map((model) => model.id))
  const baseline = process.env.OPENAI_SCRIPT_MODEL || 'gpt-5.4-mini'
  const candidate = process.env.CANDIDATE_MODEL
  if (candidate === baseline || !available.has(candidate)) throw Error('Choose a different model available to the existing account.')
  const fixtures = [
    { kind: 'songTalk', dj: { id: 'dex-monroe', name: 'Dex Monroe', style: 'Low, warm, intimate, unhurried jazz with martini-dry wit.' }, nextTrack: { artist: 'Miles Davis', title: 'So What' }, continuity: { airedCount: 0 } },
    { kind: 'songTalk', dj: { id: 'blaze-morning-crew', name: 'Rex Hammer', style: 'Playfully overconfident morning host.', coHost: { name: 'Roxie Vance', style: 'Dry and unimpressed; needles Rex.' } }, nextTrack: { artist: 'The Beatles', title: 'Eleanor Rigby' }, continuity: { airedCount: 1 }, recentScripts: ['Rex has just made a boast. Roxie was unimpressed.'] },
  ]
  const results = []
  for (const fixture of fixtures) {
    let preparedRequest
    globalThis.fetch = async (_, options) => {
      preparedRequest = JSON.parse(options.body)
      return new Response('{}', { status: 503 })
    }
    try { await handler({ method: 'POST', body: fixture }, { status() { return this }, json() {} }) }
    finally { globalThis.fetch = realFetch }
    for (const model of [baseline, candidate]) {
      const started = performance.now()
      const result = await realFetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers, body: JSON.stringify({ ...preparedRequest, model, max_output_tokens: 1200 }), signal: AbortSignal.timeout(60000),
      })
      if (!result.ok) { results.push({ model, character: fixture.dj.id, status: result.status }); continue }
      const raw = await result.json()
      const text = raw.output_text || raw.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text
      try {
        const generated = JSON.parse(text)
        const edited = constrainBreakDelivery(compilePatter(generated, fixture, preparePatter(fixture)), fixture, true)
        results.push({ model, character: fixture.dj.id, latencyMs: Math.round(performance.now() - started), usage: raw.usage, generated, edited, humanScores: { accuracy: null, warmth: null, specificity: null, repetition: null, characterFit: null } })
      } catch { results.push({ model, character: fixture.dj.id, error: 'No valid complete structured output', usage: raw.usage }) }
    }
  }
  await writeFile('patter-comparison.json', JSON.stringify({ requests: 4, note: 'Human scores are intentionally unfilled; review blind before recommending a model change.', results }, null, 2))
  console.log('Saved patter-comparison.json. Production settings unchanged.')
}
