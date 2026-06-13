// One-time generator for Airbreak's station transition beds.
//
// Renders a fixed pool of sound effects with the ElevenLabs Sound Effects API
// and writes them to public/sfx/ along with a manifest the app reads at
// runtime. Run this once (and again only when you want fresh beds); commit the
// results. The app never calls ElevenLabs in real time.
//
// Usage:
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-sfx.mjs
//
// The category/prompt definitions are mirrored from src/data.ts so the pool
// matches what the player expects.

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const sfxCategories = {
  impact: {
    count: 6,
    durationSeconds: 1.5,
    prompts: [
      'Punchy radio station imaging stinger: a fast whoosh sweeping down into a deep bass boom impact, clean and produced, no music, no voice.',
      'Hard-hitting radio drop: short reverse swell into a sub-bass slam with a metallic tail, no music, no voice.',
      'Bright broadcast impact: quick airy whoosh into a tight punchy boom, energetic station imaging, no music, no voice.',
      'Cinematic radio bumper hit: deep boom with a short downward whoosh and a clean tail, no music, no voice.',
    ],
  },
  sweep: {
    count: 8,
    durationSeconds: 1.1,
    prompts: [
      'Short radio transition whoosh sweeping downward into a song, smooth airy noise sweep, no music, no voice.',
      'Quick noise sweep transition, soft airy downward whoosh, clean radio imaging, no music, no voice.',
      'Filtered white-noise sweep sliding down into a beat, modern radio transition, no music, no voice.',
      'Light breezy whoosh transition between songs, smooth and short, no music, no voice.',
    ],
  },
  riser: {
    count: 4,
    durationSeconds: 1.3,
    prompts: [
      'Quick upward riser sweep building into a drop, energetic radio imaging transition, no music, no voice.',
      'Rising noise swell building tension into a cut, bright radio transition, no music, no voice.',
      'Short ascending whoosh riser into an impact, punchy station imaging, no music, no voice.',
    ],
  },
  scratch: {
    count: 2,
    durationSeconds: 1,
    prompts: [
      'Single quick vinyl record scratch transition, clean turntablist zip, no music, no voice.',
      'Short DJ vinyl rewind and scratch, crisp and punchy, no music, no voice.',
    ],
  },
}

const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY to generate sound effects.')
  process.exit(1)
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx')
await mkdir(outDir, { recursive: true })

async function generate(prompt, durationSeconds) {
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: 0.5,
    }),
  })
  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

const manifest = {}
let total = 0

for (const [category, config] of Object.entries(sfxCategories)) {
  manifest[category] = []
  for (let i = 0; i < config.count; i++) {
    const prompt = config.prompts[i % config.prompts.length]
    const file = `${category}-${i}.mp3`
    process.stdout.write(`Generating ${file} ... `)
    try {
      const audio = await generate(prompt, config.durationSeconds)
      await writeFile(join(outDir, file), audio)
      manifest[category].push(`/sfx/${file}`)
      total += 1
      console.log('ok')
    } catch (error) {
      console.log(`failed (${error.message})`)
    }
  }
}

await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`\nDone. ${total} effects written to public/sfx/, manifest updated.`)
