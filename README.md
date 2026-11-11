# Airbreak — AI Radio DJ

Airbreak is your personal AI radio station, built as a mobile-first web app and hosted on Vercel. Pick a virtual DJ, load your music, and go live: the host writes and voices station breaks on the fly, talks over a music bed like real radio, and works your local weather and headlines into the show.

## Features

- Mobile-first app UI with bottom tab navigation (On Air / DJs / Library / Station), installable as a PWA.
- Live radial audio visualizer around the vinyl — real waveform data while the DJ talks, ambient animation during songs.
- Real-radio talk-ups: the DJ speaks dry, the next song fades in under the last five seconds of the talk, then swells to full volume.
- A real station clock: song talk, station bumpers, fictional commercials, listener call-in requests, and news & weather rotate between songs, with a control for how often the DJ talks (every song / 2 / 3 / 5).
- Multi-voice breaks: callers speak in a different voice through a phone-line filter, and a station colleague (news desk, traffic copter, or sports desk) introduces themselves and files reports in a third voice.
- Produced bumpers: a deep imaging voice with slap-echo over a synthesized whoosh-and-boom stinger.
- Zero dead air: the opening break is written and voiced while the station is idle, and the next break is produced as soon as a song starts.
- The station playlist loads automatically on launch from the default manifest and is shuffled.
- Corrupt or unreachable tracks are probed ahead of time and skipped before the DJ ever talks them up.
- The station broadcasts from the listener's auto-detected city (Vercel geolocation), with a manual override in the Station tab; context refreshes every ten minutes.
- City research for local color: current conditions and today's range from Open-Meteo, Google News geo headlines plus a sports feed, city background from Wikipedia, and the station's real local time.
- Per-DJ theming: the whole app re-colors to match the selected host.
- Preset virtual DJs with voice, format, style, city, and backstory.
- Custom DJ creation (with color and voice picker) stored in browser local storage.
- Shared cloud music loading from JSON manifests or browsable HTML folders.
- Local audio loading with browser object URLs.
- Seek bar, volume control, true pause/resume, and lock-screen controls via the Media Session API.
- Live weather via Open-Meteo and local headlines via Google News RSS.
- Break log with every script the station has aired.
- Preloaded AI breaks before songs end to reduce dead air.
- Server-only OpenAI script and TTS routes.
- Browser speech fallback when `OPENAI_API_KEY` is not configured.

## Music manifest

The default source is:

```txt
https://mwalk.neocities.org/music/manifest.json
```

Supported manifest shapes:

```json
[
  { "artist": "Queen", "title": "We Will Rock You", "file": "16 - We Will Rock You.mp3" },
  { "file": "Amor Total.mp3" }
]
```

or:

```json
{
  "tracks": [
    { "artist": "Artist", "title": "Title", "url": "https://example.com/song.mp3" }
  ]
}
```

Relative `file` values resolve against the manifest folder.

## Local development

```bash
npm install
cp .env.example .env.local
npm run build
npx vercel dev --yes
```

Set `OPENAI_API_KEY` in `.env.local` for OpenAI-backed scripts and MP3 voices.

## Station transition sound effects

Airbreak opens produced breaks (bumpers, show opens, news, requests) with
transition beds. These are pre-generated once with the ElevenLabs Sound
Effects API and reused at runtime — the app does not call ElevenLabs while on
air. To render the pool:

```bash
ELEVENLABS_API_KEY=sk_... node scripts/generate-sfx.mjs
```

This writes ~20 effects to `public/sfx/` plus a `manifest.json`; commit them.
The player picks a random bed per transition. If the pool is absent, `/api/sfx`
generates one bed per category on demand (when `ELEVENLABS_API_KEY` is set in
the environment), and bumpers fall back to a built-in synthesized stinger.

## Vercel deployment

Set these environment variables in the Vercel project:

```txt
OPENAI_API_KEY
OPENAI_SCRIPT_MODEL=gpt-5.4-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
VOICE_PROVIDER=elevenlabs
ELEVENLABS_MODEL=eleven_v4
ELEVENLABS_API_KEY
```

Then deploy:

```bash
npx vercel --prod --yes
```

The API key is only read by `/api/dj-break` and `/api/voice`; it is never sent to the browser.

## Operator tools

Two server tools spend paid ElevenLabs credits and are not used by the listener
app, so they are disabled unless `AIRBREAK_ADMIN_TOKEN` is set, and then only
answer requests that send the same value in an `x-admin-token` header:

- `POST /api/music` — generate a jingle or sting.
- `GET /api/voices?probe=<voiceId>` and `?detail=<voiceId>` — voice diagnostics.

```bash
curl -H "x-admin-token: $AIRBREAK_ADMIN_TOKEN" "https://your-app.vercel.app/api/voices?probe=VOICE_ID"
```

Plain `GET /api/voices` (voice names and IDs) stays open.

The music-source scanner (`/api/library`) only fetches public `http(s)`
addresses; `localhost` and private-network hosts are refused.

## Expressive voices

Airbreak defaults to ElevenLabs `eleven_v4` through `/v1/text-to-dialogue`.
Keep the existing ElevenLabs key (`ElevenKey` is also accepted), DJ/co-host
voice IDs, and voice map. Generated scripts use sparse character-specific delivery tags. Dex stays measured
and warm (one tag per break); Rex can be more animated. Host, co-host, caller,
reporter and imaging roles have separate limits. Unknown/custom DJs default to
restrained delivery. The writer and voice endpoint both enforce allowed tags;
real listener-call transcripts stay verbatim.
Tags are stripped for OpenAI and browser speech fallbacks.

V4 requests preserve stability and similarity preferences using `settings`.
Legacy speed, style, and speaker-boost settings are omitted because v4 does
not support them. Explicit older-model overrides retain the legacy endpoint.
`VOICE_PROVIDER=openai` still selects OpenAI and disables generated tags.
Vercel environment changes require a new deployment; ensure an existing
`VOICE_PROVIDER` override is `elevenlabs` before publishing.

Verified against [Eleven v4 documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)
and the [dialogue API](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert).
Run charge-free request/fallback checks with `node --test tests/voice.test.js`.


## The DJ writer

`/api/dj-break` writes each break with an OpenAI model. The writer is trusted to
sound like a real jock: it may use what it knows about the music, improvise in
character, and invent small studio details. There is no fact filter on the
output. Real-world current events (news, weather, sports) still come only from
the live station context.

What shapes a break:

- **Radio craft, not rules** (`lib/patter-editor.js`): one idea per break, talk
  to one person, short spoken sentences, opinions, loose formatics, and a ban
  list of ad-copy and AI-sounding phrases.
- **A shape and a length per break** (`api/dj-break.js`): the server picks one
  of a dozen break shapes (quick hit, back-sell cold open, the story, the
  callback, the phones, ...) and a length band weighted toward short, so breaks
  stop following one template. Recent opening words are passed as `avoidOpeners`.
- **Signature moves per host** (`lib/persona-bits.js`): recurring features,
  verbal habits and stubborn opinions for each preset DJ. Two are offered per
  break, least-recently-used first. Add or edit lines there to change a host.
  Custom DJs improvise from their style and backstory.
- **Notes about the record**: sourced cards in `lib/song-cards.js`, plus the
  `facts`, `djNotes`, `year`, `album` and `liveShow` fields from your library
  manifest.
- **Show memory**: the writer leaves a one-line `showNote` after a break (a bit
  it started, a detail it invented) and gets the last eight back, so running
  gags and callbacks carry across breaks.

### Using a better writer model

Set `OPENAI_SCRIPT_MODEL` to any model your OpenAI account can use (the default
is `gpt-5.4-mini`). In Vercel: Project → Settings → Environment Variables → add
`OPENAI_SCRIPT_MODEL`, then redeploy. If the name is wrong or the account lacks
access, the writer logs a warning and falls back to the default instead of
going silent. Each break's response includes `writerModel`, so you can confirm
which model wrote it. `scripts/compare-patter.mjs` runs a small side-by-side of
two models on the same prompts.

Recent scripts and used material IDs
persist per DJ, per browser/device for sixty days; the Station tab can clear one
DJ's memory. Blocked storage falls back to session memory. Memory records when
a break actually starts playing, not when it is generated; an interrupted break
may therefore count as used. Foreground and background playback share this path,
and stale background breaks are rejected when DJ or track context differs.
This does not synchronize memory across devices.

Run charge-free checks:

```bash
npm test
npm run lint
npm run build
```

An optional, bounded text-only model comparison uses the same real prompt for
Dex and Rex, with four generations total and no audio:

```bash
OPENAI_API_KEY=<existing-key> CANDIDATE_MODEL=<available-model-id> node scripts/compare-patter.mjs --run
```

The script checks account model availability and writes `patter-comparison.json`
with outputs, latency, usage, and a blank human-scoring rubric for warmth,
specificity, repetition and character fit.
