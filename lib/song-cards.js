// Reviewed research cache. Facts refer to a work or an explicitly identified
// recording; a title match alone never establishes which recording is playing.
// Add reviewed cards here, not model-generated trivia in a playlist manifest.
const checkedAt = '2026-10-05'
const card = (id, artist, title, album, source, facts, cues = []) => ({
  id, artist, title, recording: { album, version: 'original studio recording' },
  checkedAt, source, facts: facts.map(([suffix, text, scope = 'work']) =>
    ({ id: `${id}:${suffix}`, text, scope, source, checkedAt })),
  listeningCues: cues.map(([suffix, text]) =>
    ({ id: `${id}:${suffix}`, text, scope: 'recording', source, checkedAt })),
})
export const songCards = [
  card('dead-scarlet-begonias', 'Grateful Dead', 'Scarlet Begonias', null, 'https://www.dead.net/song/scarlet-begonias', [
    ['writers', 'Robert Hunter wrote the words to Scarlet Begonias, and Jerry Garcia wrote the music.'],
  ]),
  card('cash-i-walk-the-line', 'Johnny Cash', 'I Walk the Line', null, 'https://www.johnnycash.com/track/i-walk-the-line/', [
    ['hall-of-fame', 'Johnny Cash\'s I Walk the Line received a Grammy Hall of Fame award in nineteen ninety-eight.'],
  ]),
  card('beatles-eleanor-rigby', 'The Beatles', 'Eleanor Rigby', 'Revolver', 'https://www.thebeatles.com/eleanor-rigby', [
    ['release', 'The Beatles released Eleanor Rigby on Revolver and as a single in nineteen sixty-six.'],
    ['strings', 'George Martin arranged a double string quartet for the original Eleanor Rigby recording.'],
  ], [['strings-cue', 'Listen for the string arrangement around the vocal.']]),
  card('beatles-all-you-need-is-love', 'The Beatles', 'All You Need Is Love', 'Magical Mystery Tour', 'https://www.thebeatles.com/all-you-need-love-0', [
    ['broadcast', 'The Beatles first performed All You Need Is Love on the Our World international television broadcast.'],
    ['single', 'The Beatles released All You Need Is Love as a single in July nineteen sixty-seven.'],
  ]),
  card('beatles-here-comes-the-sun', 'The Beatles', 'Here Comes the Sun', 'Abbey Road', 'https://www.thebeatles.com/here-comes-sun', [
    ['writer', 'George Harrison wrote Here Comes the Sun.'],
    ['album', 'The Beatles included Here Comes the Sun on Abbey Road in nineteen sixty-nine.'],
  ]),
  card('miles-so-what', 'Miles Davis', 'So What', 'Kind of Blue', 'https://www.milesdavis.com/albums/kind-of-blue/', [
    ['opener', 'So What opens Miles Davis\'s Kind of Blue.'],
    ['release', 'Miles Davis released Kind of Blue in August nineteen fifty-nine.'],
  ], [['phrasing', 'Listen for the space in Miles\'s trumpet phrasing.']]),
  card('miles-blue-in-green', 'Miles Davis', 'Blue in Green', 'Kind of Blue', 'https://www.milesdavis.com/albums/kind-of-blue/', [
    ['album', 'Blue in Green is the third track on Miles Davis\'s Kind of Blue.'],
  ]),
  card('miles-all-blues', 'Miles Davis', 'All Blues', 'Kind of Blue', 'https://www.milesdavis.com/albums/kind-of-blue/', [
    ['album', 'All Blues is one of the five tracks on Miles Davis\'s Kind of Blue.'],
  ]),
]
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/^the /, '').replace(/[^a-z0-9]+/g, ' ').trim()
const index = new Map(songCards.map((item) => [`${normalize(item.artist)}|${normalize(item.title)}`, item]))

export function lookupSongCard(track) {
  if (!track || track.metadataConfidence === 'low') return null
  const found = index.get(`${normalize(track.artist)}|${normalize(track.title)}`)
  if (!found) return null // no fuzzy matches, covers or unreviewed facts
  const identity = `${track.title || ''} ${track.version || ''} ${track.url || ''}`
  const alternate = Boolean(track.liveShow) || /\b(live|remix|demo|alternate|take|concert)\b/i.test(identity)
  // Album text alone is not proof of a master: require an explicit version.
  const recordingMatched = Boolean(found.recording.album) && !alternate && normalize(track.album) === normalize(found.recording.album) &&
    track.version === found.recording.version
  return {
    ...found, recordingMatched,
    identity: { artist: track.artist, title: track.title, album: track.album || null, version: track.version || (track.liveShow ? 'live' : 'unverified') },
    facts: found.facts.filter((fact) => fact.scope === 'work' || recordingMatched),
    listeningCues: recordingMatched ? found.listeningCues : [],
  }
}
