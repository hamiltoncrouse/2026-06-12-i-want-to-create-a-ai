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


## Reviewed patter and show continuity

The writer keeps `gpt-5.4-mini` by default. Intro/song-talk material comes from
`lib/song-cards.js` and `lib/persona-canon.js`. The starter cache has eight
reviewed songs with official source links and review dates. Matching requires
exact artist/title identity; low-confidence metadata gets no card. Work-level
facts may apply to other performances, but recording-specific cues additionally
require matching album and `version: "original studio recording"`, with no live
show or alternate-version marker. Missing coverage gets natural transitions,
not made-up trivia. Playlist `facts` and `djNotes` are not treated as research.

`GET /api/song-card?artist=...&title=...` is a cacheable on-demand lookup of
these reviewed cards, not an automatic research or paid generation service.
New coverage requires reviewing sources and adding cards. The writer receives
at most one selected fact, listening cue, or fictional life bit and returns a
placeholder; the server inserts its approved wording and exposes source links
in the break log. A conservative rule-based screen rejects common unsupported
history/biography patterns in music patter; it is not a semantic fact verifier.

Fourteen fictional hosts have three stable life/callback items each. A callback
is available only after its prerequisite story aired. Johnny London and Sir Paul
receive no invented autobiographical canon. Recent scripts and used material IDs
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
with outputs, latency, usage, and a blank human-scoring rubric. Do not change the
production writer model without comparing accuracy, warmth, specificity,
repetition and character fit. No comparison is implied by the automated tests.
