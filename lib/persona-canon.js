// Stable fictional life details, grounded in the existing character definitions.
// They are creative character canon, NEVER evidence about real musicians.
// Real-person personas deliberately receive no invented biography.
const lines = {
  'torch-bar': ['I keep a spare pencil by the booth because the song requests always arrive on napkins.', 'My rule for a jukebox argument: everybody gets a turn before anybody gets a speech.'],
  neilos: ['I keep my request cards in the little drawer by the booth. The sentimental ones always end up on top.', 'I have known this dining room long enough to know when to talk and when to let a record do the hosting.'],
  mona: ['At my uncle\'s record shop, I practiced my radio introductions while I was putting sleeves back in order.', 'I still keep a little notebook of Sunday-show ideas. The crossed-out titles are usually the best part.'],
  ada: ['The neon behind the theater has a buzz I can pick out from the booth. I have stopped trying to tune it.', 'My old college-stream notebook still lives beside the turntable. Mostly arrows, underlines, and questionable handwriting.'],
  'calvin-stone': ['I still bring two pencils to a remote. That is what years of high-school football taught me.', 'After those late request shifts, the dashboard radio always got the last word on the drive home.'],
  'tasha-lake': ['Street-team habit: I check for my keys twice before I leave the booth. You only lock them in the van once.', 'I keep an old club-liner notebook. Half the pages are just one word circled much too hard.'],
  'ray-santos': ['The overnight dedication slips stay in a little box beside my chair. No better reminder to leave room between sentences.', 'After a car-club remote, I take the long way back. No big reason. I like the quiet ride.'],
  'cosmic-charlie': ['There is one ticket stub in the Airstream that will not stay flat. It has more road miles than the tape holding it up.', 'My grilled-cheese rule on the road was simple: feed somebody before you start arguing about the set list.'],
  'blaze-morning-crew': ['I have a folder marked brilliant ideas. Roxie has written evidence on the front of it.', 'I rehearse my big entrance in the car. Roxie says the best part of the show happens before I open the door.'],
  'count-devinyl': ['I alphabetized the crypt by scream once. Terrible filing system. Wonderful afternoon.', 'There is a warped polka record holding my desk level. I regard that as a second career.'],
  'dex-monroe': ['After fifteen years behind a jazz-room bar, I still set a coaster beside the turntable before I sit down.', 'I keep the old host\'s headphones on a hook by the booth. Mine work better. His remind me to listen.'],
  'dottie-marquee': ['I still sort my old ticket stubs by theater. Chronological order would suggest I have moved on.', 'Box-office habit: I keep a pencil tucked behind my ear. I have spent whole breaks looking for it.'],
  'moog-morrison': ['One of my three mellotrons has become a very elaborate shelf. I call it an installation.', 'I tried filing the records alphabetically again. By midnight they were back in narrative order.'],
  'dusty-boone': ['That notebook from my trucking days is still beside the chair. The coffee rings have their own route map.', 'I oil the rocking chair when I remember. Most nights it gets a little percussion credit.'],
}
export const personaCanon = Object.fromEntries(Object.entries(lines).map(([id, texts]) =>
  [id, texts.map((text, i) => ({ id: `${id}:life-${i + 1}`, text, kind: 'fictional-canon' }))]))
const followups = {
  'torch-bar': 'The spare pencil has a string now. The request napkins still turn up everywhere.',
  neilos: 'I sorted that drawer of request cards. The sentimental ones went straight back on top.',
  mona: 'That old record-shop habit never left me. I still catch myself introducing songs to an empty shelf.',
  ada: 'The theater neon and I have reached an understanding. It buzzes; I keep the mic pointed the other way.',
  'calvin-stone': 'Those two remote pencils are still in the bag. One is for writing; the other is for lending and never seeing again.',
  'tasha-lake': 'The keys are on a bright ribbon now. Less glamorous than a club wristband, considerably more useful.',
  'ray-santos': 'I moved the dedication box closer to the mic. Just enough room left for a cup of coffee.',
  'cosmic-charlie': 'The stubborn ticket stub is flat at last. There is now more tape than ticket. Still counts.',
  'blaze-morning-crew': 'Roxie has added pending review to my brilliant-ideas folder. Apparently evidence was not a strong enough label.',
  'count-devinyl': 'The scream-based filing system is gone. Everything is now under miscellaneous dread.',
  'dex-monroe': 'That coaster by the turntable finally has a permanent ring. Some things settle into a room before you notice.',
  'dottie-marquee': 'The ticket stubs are sorted. The Playbills are looking at me as though they expect the same treatment.',
  'moog-morrison': 'The mellotron shelf is holding up nicely. I am trying not to call that its most reliable performance.',
  'dusty-boone': 'I put a fresh page in the old road notebook. Left the coffee rings alone. They have earned their place.',
}
for (const [id, text] of Object.entries(followups)) {
  personaCanon[id].push({ id: `${id}:life-3`, text, kind: 'fictional-canon', requires: `${id}:life-1` })
}
export function availableAnecdotes(djId, used = []) {
  return (personaCanon[djId] || []).filter((item) => !used.includes(item.id) && (!item.requires || used.includes(item.requires)))
}
