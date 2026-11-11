import { lookupSongCard } from './song-cards.js'
import { personaCanon } from './persona-canon.js'
import { rotateBits } from './persona-bits.js'

// The writer is trusted to sound like a real jock: it may draw on what it
// knows about the music and improvise in character. This module only gathers
// useful raw material for each break and keeps track of what has been used so
// the show does not repeat itself.

const ids = (value) => (Array.isArray(value) ? value.filter((s) => typeof s === 'string').slice(-100) : [])
const strings = (value, count, length) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, count)
    .map((item) => item.slice(0, length))

const TALK_KINDS = ['intro', 'songTalk']

function pickTwo(pool) {
  const copy = [...pool]
  const picked = []
  while (copy.length && picked.length < 2) {
    picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  }
  return picked
}

export function preparePatter(body) {
  const memory = body.continuity || {}
  const usedFacts = ids(memory.usedFactIds)
  const usedLife = ids(memory.usedAnecdoteIds)
  const track = body.nextTrack || body.currentTrack
  const card = lookupSongCard(track)
  const count = Number.isSafeInteger(memory.airedCount) ? memory.airedCount : 0
  const material = []

  if (TALK_KINDS.includes(body.kind || 'songTalk')) {
    // Sourced notes about the record, freshest first.
    const cardNotes = [...(card?.facts || []), ...(card?.listeningCues || [])].filter(
      (fact) => !usedFacts.includes(fact.id),
    )
    for (const fact of cardNotes.slice(0, 2)) material.push({ ...fact, type: 'fact' })

    // Whatever the station library says about this track.
    const libraryNotes = [...strings(track?.facts, 3, 200), ...strings([track?.djNotes], 1, 280)]
    libraryNotes.forEach((text, index) => {
      material.push({ id: `library:${index + 1}`, type: 'library', text })
    })

    // Two of the host's signature moves, rotated so quirks recur without
    // becoming a tic, plus one piece of established life detail.
    const djId = body.dj?.id
    // Offer two at random from the fresh ones (or, once all have aired, from
    // the ones used longest ago) so an ignored suggestion is not offered forever.
    const rotation = rotateBits(djId, usedLife)
    const fresh = rotation.filter((bit) => !usedLife.includes(bit.id))
    const pool = fresh.length >= 2 ? fresh : rotation.slice(0, 4)
    for (const bit of pickTwo(pool)) material.push({ ...bit, type: 'bit' })
    const canon = personaCanon[djId] || []
    if (canon.length) {
      const lastUsed = new Map(usedLife.map((id, index) => [id, index]))
      const life = [...canon].sort((a, b) => (lastUsed.get(a.id) ?? -1) - (lastUsed.get(b.id) ?? -1))[0]
      material.push({ ...life, type: 'life' })
    }
  }

  return { card, material, hasPreviousShows: count > 0 }
}

// How a real jock sounds, and what makes copy read as machine-written.
export const patterInstructions = [
  'HOW A REAL JOCK SOUNDS.',
  'You are writing words that will be spoken aloud, live, over the intro of a record. Write for the ear, not the page.',
  'Talk to ONE person, mid-thought, as if the mic was already open. No greetings, no "welcome back", no announcing what you are about to do.',
  'Short sentences. Contractions. Fragments. Start sentences with And, But, So. Interrupt yourself. Leave a thought unfinished and let the record finish it.',
  'One idea per break. Say the thing, hit the title, get out. The song is the star.',
  'Specific beats general, every time: a street, a smell, what the sky is doing, who played bass, the year, the studio, the guy who called an hour ago.',
  'Have opinions. A jock likes this one more than the last one and says so. Tease, complain, brag, admit something, be wrong on purpose.',
  'You know music. Use what you know about the record, the artist, the session, the scene, the way someone with thirty years of liner notes in their head would: one detail, tossed off, never a recital. If you are not sure of a detail, hedge the way a jock does ("I want to say seventy-four?") or leave it out.',
  'Radio formatics, used loosely and never all at once: back-sell what just played, front-sell what is next (title and artist somewhere, not always at the end, not always both), the station name or call letters, the time ("ten past four"), the day, the weather in six words.',
  'You are the host in dj.style and dj.backstory. Live in it: your past, your town, your habits, your grudges, the room you are sitting in. Invent small in-character details freely (what is on the desk, who just walked past the window, what you had for lunch) and keep them consistent with showNotes.',
  'patter.material is optional raw material for this break: notes about the record, and a few of this host\'s signature moves. Use at most one or two, in your own words, never recited. Put the ids you actually used in usedMaterialIds.',
  'Running bits make a show. If showNotes or recentScripts started something, push it one step further now and then. Write showNote as one short line worth remembering for later breaks (a bit you started, a promise, a detail you invented) or leave it empty.',
  'WHAT TO AVOID. Never sound like ad copy, a press release, or an AI assistant.',
  'Banned phrases and moves: "buckle up", "sit back and relax", "get ready", "let\'s dive in", "vibes", "sonic", "journey", "timeless", "iconic", "masterpiece", "classic tune", "what a track", "takes us back", "there\'s something about", "nothing quite like", "whether you\'re X or Y", "keep it locked", "stay tuned". No rhetorical-question openers. No lists of three adjectives. No summing-up moral at the end. No explaining your own joke. No exclamation marks unless the character truly shouts.',
  'Never open two breaks the same way: avoidOpeners lists how recent breaks began, so start somewhere else entirely, and do not open with the host\'s own name or "That was".',
  'Vary the rhythm from recentScripts: if the last break was long, be brief; if it ended on the title, end on something else.',
].join(' ')

export function compilePatter(plan, body, patter) {
  const offered = new Map(patter.material.map((item) => [item.id, item]))
  const used = [...new Set(Array.isArray(plan.usedMaterialIds) ? plan.usedMaterialIds : [])]
    .map((id) => offered.get(id))
    .filter(Boolean)
  const segments = (plan.segments || []).map((segment) => {
    if (segment.speaker === 'caller' && body.listenerCall) {
      return { ...segment, text: String(body.listenerCall.text || '') }
    }
    const text = String(segment.text || '')
      // Tidy anything unspeakable: stray template braces, markdown, doubled spaces.
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/[*_#`]+/g, '')
      .replace(/ {2,}/g, ' ')
      .trim()
    return { ...segment, text }
  }).filter((segment) => segment.text || (segment.speaker === 'caller' && body.listenerCall))
  const facts = used.filter((item) => item.type === 'fact')
  // Bits and life details both rotate through the same memory.
  const life = used.filter((item) => item.type === 'bit' || item.type === 'life')
  const { usedMaterialIds: _ignored, ...rest } = plan
  void _ignored
  return {
    ...rest,
    segments,
    script: segments.map((segment) => segment.text).join(' '),
    showNote: String(plan.showNote || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    usedFactIds: facts.map((fact) => fact.id),
    usedAnecdoteIds: life.map((item) => item.id),
    evidence: facts
      .filter((fact) => fact.source)
      .map(({ id, text, source, checkedAt }) => ({ id, text, source, checkedAt })),
    researchCoverage: patter.card ? 'reviewed-card' : 'no-reviewed-card',
    qualityIssues: [],
  }
}
