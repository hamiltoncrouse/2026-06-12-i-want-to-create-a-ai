import { lookupSongCard } from './song-cards.js'
import { availableAnecdotes } from './persona-canon.js'

const ids = (value) => Array.isArray(value) ? value.filter((s) => typeof s === 'string').slice(-100) : []
export function preparePatter(body) {
  const memory = body.continuity || {}
  const usedFacts = ids(memory.usedFactIds)
  const usedLife = ids(memory.usedAnecdoteIds)
  const card = lookupSongCard(body.nextTrack || body.currentTrack)
  const facts = [...(card?.facts || []), ...(card?.listeningCues || [])].filter((fact) => !usedFacts.includes(fact.id))
  const anecdotes = availableAnecdotes(body.dj?.id, usedLife)
  // Editorial rotation, not random pressure to invent a fact on every break.
  const count = Number.isSafeInteger(memory.airedCount) ? memory.airedCount : 0
  const preferLife = count % 3 === 1 || !facts.length
  const selected = preferLife ? anecdotes[0] || facts[0] : facts[0] || anecdotes[0]
  const isLife = selected?.kind === 'fictional-canon'
  const material = selected && ['intro', 'songTalk'].includes(body.kind || 'songTalk')
    ? [{ ...selected, type: isLife ? 'life' : 'fact' }] : []
  return { card, material, hasPreviousShows: count > 0 }
}

export const patterInstructions = [
  'Sound like a familiar music-loving friend speaking to one person. Prefer a short specific thought, an understated reaction, and an easy handoff; do not force a punchline, biography, catchphrase, station slogan or excitement into every break.',
  'For intro and songTalk aim for 35 to 65 words, unless a genuine conversation needs more. Leave room for the music.',
  'patter.material contains the only approved song facts, listening cues or personal-life anecdotes for this break. Include zero or one by copying its placeholder exactly: {{fact:ID}} or {{life:ID}}. Do not paraphrase, embellish, or restate that material elsewhere: the server inserts the verified sentence. Do not use other fact or life IDs.',
  'Outside these placeholders, write only present-tense subjective reactions, transitions, track/artist names and supplied station context. Never supply music history, dates, awards, recording details, quotations, specific instrumental claims, or new personal-life stories from your own knowledge. Playlist facts, djNotes, confidence labels and backstory are not independently verified song research.',
  'If no approved material exists, skip trivia and biography naturally. Do not announce missing research or apologize. You may say how you feel about a song without inventing its sonic details.',
  'Character canon is stable fiction, not evidence about real artists or businesses. For real-person personas do not invent autobiographical anecdotes or personal relationships. Never create a sibling, partner, job, event, or meeting outside the approved life material.',
  'Continuity describes previous broadcasts on this device, not knowledge about the listener. Do not invent listener memories, relationships, private details or promises. Address explicitly supplied requests naturally, without claiming a longstanding relationship. On a renewed show, avoid repeating an introduction, fact or life story from recentScripts. Do not promise a future story or song unless it is actually supplied in the queue.',
  'Return showNote as an empty string; continuity is recorded from the approved material actually aired.',
].join(' ')

// Conservative guard for unsupported factual/life claims in generated music
// connective prose. Approved material is inserted AFTER this check. This is a
// fail-closed rule-based screen, not a claim of general semantic verification.
export function unsupportedClaim(text) {
  return /\b(?:18|19|20)\d{2}\b|\b(?:released?|recorded|recording sessions?|produced|producer|composed|written|wrote|co-wrote|chart(?:ed|s)?|grammy|award|b-side|debut|born|died|first performed|originally|broke up|formed the|formed in|sold \w+ (?:million|copies)|features? (?:a |the )?(?:guitar|piano|bass|drum|horn|string)|plays? (?:the )?(?:guitar|piano|bass|drums)|sample[ds]? from)\b|\b(?:my (?:sister|brother|wife|husband|partner|mother|father|uncle|aunt|daughter|son)|I (?:grew up|used to|worked|remember|met|drove|started|learned)|when I was)\b/i.test(text)
}

export function compilePatter(plan, body, patter) {
  const material = new Map(patter.material.map((item) => [`${item.type}:${item.id}`, item]))
  const used = new Set(), evidence = [], life = [], issues = []
  const segments = plan.segments.map((segment) => {
    if (segment.speaker === 'caller' && body.listenerCall) return { ...segment, text: String(body.listenerCall.text || '') }
    let text = String(segment.text || '')
    const references = [...text.matchAll(/\{\{(fact|life):([^{}]+)\}\}/g)]
    let prose = text.replace(/\{\{[^{}]*\}\}/g, '')
    for (const track of [body.previousTrack, body.nextTrack, body.currentTrack]) {
      for (const name of [track?.title, track?.artist]) {
        if (typeof name === 'string' && name) prose = prose.split(name).join('')
      }
    }
    if (['intro', 'songTalk'].includes(body.kind || 'songTalk') && unsupportedClaim(prose)) {
      issues.push('unsupported-claim')
      const ref = references.find((match) => material.has(`${match[1]}:${match[2]}`))
      // Keep only a valid requested reference, plus a neutral transition.
      text = `${ref?.[0] || ''} Let's keep the music going.`
    }
    text = text.replace(/\{\{(fact|life):([^{}]+)\}\}/g, (_, type, id) => {
      const item = material.get(`${type}:${id}`)
      if (!item || used.size || used.has(id)) { issues.push('unapproved-or-repeated-reference'); return '' }
      used.add(id)
      if (type === 'fact') evidence.push(item)
      else life.push(id)
      return item.text
    }).replace(/\{\{[^{}]*\}\}/g, '').replace(/ {2,}/g, ' ').trim()
    return { ...segment, text }
  })
  return {
    ...plan, segments, script: segments.map((s) => s.text).join(' '), showNote: '',
    usedFactIds: evidence.map((fact) => fact.id), usedAnecdoteIds: life,
    evidence: evidence.map(({ id, text, source, checkedAt }) => ({ id, text, source, checkedAt })),
    researchCoverage: patter.card ? 'reviewed-card' : 'no-reviewed-card',
    qualityIssues: [...new Set(issues)],
  }
}
