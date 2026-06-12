# Airbreak AI DJ

Airbreak is a Vercel-hosted AI DJ desk. It can load a music manifest, accept local audio files, run preset or custom virtual DJs, generate live station breaks, and synthesize those breaks as DJ voice audio through OpenAI.

## Features

- Preset virtual DJs with voice, format, style, city, and backstory.
- Custom DJ creation stored in browser local storage.
- Shared cloud music loading from JSON manifests or browsable HTML folders.
- Local audio loading with browser object URLs.
- Live weather via Open-Meteo and local headlines via Google News RSS.
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

## Vercel deployment

Set these environment variables in the Vercel project:

```txt
OPENAI_API_KEY
OPENAI_SCRIPT_MODEL=gpt-5.4-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
```

Then deploy:

```bash
npx vercel --prod --yes
```

The API key is only read by `/api/dj-break` and `/api/voice`; it is never sent to the browser.
