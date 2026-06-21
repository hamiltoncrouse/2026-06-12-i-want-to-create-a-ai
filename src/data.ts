import type {
  BreakKind,
  DjProfile,
  ProducedSpot,
  SessionSteering,
  StationContext,
  Track,
  VenueProfile,
  VoiceName,
} from './types'

export const blankVenue: VenueProfile = {
  name: '',
  tagline: '',
  cuisine: '',
  owners: '',
  chef: '',
  team: [],
  signatureDishes: [],
  specials: [],
  drinks: [],
  events: [],
  hours: '',
  vibe: '',
  lore: [],
}

// Trim text fields and drop empty list lines before saving an edited venue.
export function cleanVenue(venue: VenueProfile): VenueProfile {
  const list = (items: string[]) =>
    (items || []).map((item) => item.trim()).filter(Boolean)
  const text = (value: string) => (value || '').trim()
  return {
    name: text(venue.name),
    tagline: text(venue.tagline || ''),
    cuisine: text(venue.cuisine),
    owners: text(venue.owners),
    chef: text(venue.chef),
    team: list(venue.team),
    signatureDishes: list(venue.signatureDishes),
    specials: list(venue.specials),
    drinks: list(venue.drinks),
    events: list(venue.events),
    hours: text(venue.hours),
    vibe: text(venue.vibe),
    lore: list(venue.lore),
  }
}

export const defaultFolderUrl = 'https://mwalk.neocities.org/music/manifest.json'

export const demoTracks: Track[] = [
  {
    id: 'demo-1',
    title: 'SoundHelix Song 1',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    source: 'demo',
  },
  {
    id: 'demo-2',
    title: 'SoundHelix Song 2',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    source: 'demo',
  },
  {
    id: 'demo-3',
    title: 'SoundHelix Song 3',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    source: 'demo',
  },
]

// The DJ selected when the app first opens.
export const defaultDjId = 'johnny-london'

export const presetDjs: DjProfile[] = [
  {
    id: 'torch-bar',
    name: 'Casey Buckham',
    handle: 'Live from The Torch',
    format: 'classic rock, Motown, pub jukebox favorites, game-day energy, and Flint barroom requests',
    city: 'Flint, MI',
    stationName: 'Torch Radio',
    callsign: 'The Torch',
    voice: 'cedar',
    style:
      'A sharp, friendly downtown Flint bar host broadcasting from upstairs on Buckham Alley. Sounds like a regular who knows the room: warm, quick, good with burger talk, proud of Flint without overselling it, and relaxed enough for lunch but lively enough for a Friday night. Drops menu specifics naturally instead of sounding like an ad read.',
    backstory:
      'Casey Buckham hosts Torch Radio from The Torch Bar & Grill at 522 Buckham Alley in downtown Flint. Casey learned the room by watching lunch regulars, nearby college and business crowds, Capitol Theatre spillover, game-day tables, and late-night bar seats all turn into the same conversation. The show treats The Torch like Flint’s upstairs clubhouse: burgers on the grill, popcorn going, Guinness on draft, and somebody at the bar who knows where you parked.',
    venue: {
      name: 'The Torch Bar & Grill',
      tagline: 'Home of the Torch Burger and a downtown Flint regulars room for over 60 years',
      cuisine: 'classic pub food, half-pound fresh-ground burgers, bar snacks, sandwiches, beer, wine, and cocktails',
      owners: 'Ron Sims',
      chef: 'the Torch kitchen crew',
      team: [
        'the Buckham Alley bar crew',
        'the kitchen team hand-pattying burgers',
        'the servers working the upstairs room',
        'the regulars holding down the bar seats',
        'the game-day crowd watching Flint and Detroit sports',
      ],
      signatureDishes: [
        'the Original Torch Burger, a half-pound fresh-ground burger hand-pattied several times a day',
        'the Jr. Torch Burger combo with fries or tots',
        'burgers cooked to order with ketchup, mustard, pickle, and onion unless guests say otherwise',
        'wedge-cut fries and tots',
        'onion rings and the half-and-half basket with fries and rings',
        'cheese curds, pickle fries, mini tacos, jalapeno poppers, and wing dings',
        'Steak & Onion, BLT, Club Sandwich, Coney Island, Reuben, and grilled cheese',
        'turkey burger and chipotle black bean burger',
        'complimentary popcorn at the bar',
      ],
      specials: [
        'Torch Burger talk whenever the grill is busy, especially because the kitchen asks for at least 20 minutes',
        'fried fish and sandwich chatter when the room wants something besides burgers',
        'pre-show and post-show stops for Capitol Theatre nights',
        'nearby college and office lunch breaks downtown',
        'game-day bar chatter for Lions, Tigers, Pistons, Red Wings, and Michigan sports',
      ],
      drinks: [
        'Guinness Draft, a Torch point of pride',
        'a rotating draft board with local and old-school staples',
        'Michigan beers when they are on the board',
        'cocktails, wine, and cold beer for the upstairs bar',
        'beer flights when the draft list is right',
      ],
      events: [
        'downtown Flint lunch rush',
        'Capitol Theatre spillover on show nights',
        'Friday and Saturday late-night bar crowd',
        'game-day watch energy',
        'regulars swapping stories over burgers and popcorn',
      ],
      hours:
        'open seven days, generally lunch through late night; the menu lists Monday through Thursday eleven to eleven, Friday and Saturday eleven to one, and Sunday noon to eleven, but exact hours should be confirmed before a special trip',
      vibe:
        'upstairs downtown Flint pub, old-time bar, cozy room, friendly regulars, fresh burgers, free popcorn, Guinness, rotating taps, and no-nonsense hospitality',
      lore: [
        'The Torch is at 522 Buckham Alley in downtown Flint',
        'The Torch menu says the bar has served downtown Flint for over 60 years',
        'The Torch Burger is widely treated as a Genesee County burger landmark',
        'The burger is made with fresh ground beef from a local Flint supplier, never frozen or preformed',
        'Torch Burgers are hand-pattied several times a day and grilled to order',
        'The Original Torch Burger comes with ketchup, mustard, pickle, and onion unless guests ask otherwise',
        'The kitchen advises guests to allow at least 20 minutes for burger orders',
        'The Torch has been recognized as a strong Guinness Draft account for a little bar tucked in an alley',
        'The bar sits about a half block from the Capitol Theatre, so show nights can spill into the room',
        'The Torch is a short walk from downtown Flint colleges and businesses',
        'The Torch is an upstairs bar, which makes walking in feel like finding a Flint clubhouse above the alley',
        'Complimentary popcorn is part of the Torch bar rhythm',
      ],
    },
    elevenVoice: 'iP95p4xoKVk53GoZ742B', // Chris — casual, friendly American
    color: '#d6492f',
  },
  {
    id: 'neilos',
    name: 'Sal Marino',
    handle: "Live from Rob's Bar & Grill",
    format: 'supper-club oldies, Motown, classic rock, and feel-good dinner music',
    city: 'Flint, MI',
    stationName: "Rob's Radio",
    callsign: "Rob's Bar & Grill",
    voice: 'cedar',
    style:
      "Warm, hospitable in-house host broadcasting live from inside Rob's Bar & Grill in Flint. Part emcee, part maitre d': makes you hungry, treats every listener like a regular, name-drops the chef and the floor staff, and keeps the room feeling like a Friday night. Generous, a little showman, never corporate.",
    backstory:
      "Sal Marino is the voice of Rob's Radio, hosting nightly from a little booth by the bar at Rob's Bar & Grill. He has known the Petrakis family for thirty years and treats the dining room like his living room.",
    venue: {
      name: "Rob's Bar & Grill",
      tagline: 'A Flint hometown supper club and sports bar since 1987',
      cuisine: 'American grill, Flint coney classics, and big-portion comfort food',
      owners: 'Rob and Donna Petrakis, who opened the place in 1987',
      chef: 'Executive Chef Lorraine "Lo" Castellano',
      team: [
        "Carlos, Rob's son, who runs the front of the house",
        'Sherry behind the bar, pouring for 22 years',
        'Big Mike on the grill',
        'Danny, the sous chef',
        'Carla on the floor',
        'Tony the bartender',
        'Patty at the host stand',
        'Kevin, the new server everyone is rooting for',
      ],
      signatureDishes: [
        'the Buick City smashburger',
        'Flint-style coney dogs',
        'garlic-parmesan wings',
        "Chef Lo's Friday lake perch fry",
        'the 1987 ribeye',
        'loaded coney fries',
        "Donna's lemon icebox pie",
      ],
      specials: [
        'Monday: half-price wings',
        'Taco Tuesday with two-dollar street tacos',
        'Wednesday prime rib and trivia',
        'Thursday wing night and karaoke',
        'Friday lake perch fish fry',
        'Saturday live music and the slow-smoked rib special',
        'Sunday brunch with kids eat free',
      ],
      drinks: [
        'the Vernors Float Old Fashioned',
        'the Buick City Mule',
        'a Faygo Redpop margarita',
        'four-dollar Michigan drafts at happy hour, four to six',
      ],
      events: [
        "Rob's Open Mic Night on Wednesdays at eight, where Rob himself might break out the guitar and play a little something",
        'Trivia Tuesday at eight',
        'Karaoke Thursday at nine',
        'Live music every Friday and Saturday at nine',
        'Sunday game-day watch parties for the Lions, Tigers, Pistons, and Red Wings',
        "Rob's birthday bash next Saturday",
      ],
      hours: 'open eleven to midnight daily, kitchen until eleven, Sunday brunch ten to two',
      vibe: 'loud, warm, generous portions, hometown Flint, the corner booth is the regulars table and there is a Wall of Regulars by the door',
      lore: [
        'Rob Petrakis opened the place in 1987 after years at the plant',
        "Rob's son Carlos runs the front of the house, and Rob keeps a guitar behind the bar for open mic night",
        'Sherry knows every regular’s drink before they sit down',
        "Chef Lo guards her secret coney sauce recipe like gold",
        'the old jukebox by the door only plays Bob Seger',
        'the corner booth is permanently reserved for the regulars',
      ],
    },
    elevenVoice: 'pqHfZKP75CvOlQylNhV4', // Bill — warm, trustworthy older American
    color: '#c8462f',
  },
  {
    id: 'johnny-london',
    name: 'Johnny London',
    handle: 'WICH morning-drive legend',
    format: 'personality radio, oldies, community bulletins, local sports, and Norwich stories',
    city: 'Norwich, CT',
    stationName: 'WICH 1310 AM',
    callsign: 'W I C H',
    voice: 'echo',
    style:
      'Classic Eastern Connecticut morning-drive jock: warm, quick, neighborly, confident, funny without being slick, and always rooted in Norwich. He naturally drops in local sponsors and civic traditions when they fit, especially Blue Ribbon Pontiac, Joe Goldberg, and the Rose Arts Festival.',
    backstory:
      'Johnny London, born Jean Gildart, was the #1 morning drive personality in Eastern Connecticut through the 1970s, 1980s, and 1990s. He helped define WICH 1310 AM Personality Radio in Norwich, Connecticut: a 5,000-watt community station with roots back to September 1946, originally WNOC. Johnny is remembered for his 1973 fifty-four-hour continuous record-spinning endurance marathon for local youth football, his crusade to help save the historic Wauregan Hotel, and a 1997 radiothon that kept a historic Abraham Lincoln banner in Norwich. He knows Tower Hill Road, the three-tower array, Hall Communications, and the old-school WICH lineup, including Stu Bryer and Potpourri. He loves talking about Blue Ribbon Pontiac at 400 West Thaymes Street and owner Joe Goldberg, and he brings up the Rose Arts Festival like a hometown ritual: music acts all over town, the Pancake Breakfast, and the Rotary Club volunteers making it happen.',
    elevenVoice: 'mKoqwDP2laxTdq1gEgU6', // Johnny London — chosen voice
    color: '#f45d48',
  },
  {
    id: 'mona',
    name: 'Mona Vinyl',
    handle: 'Soul radio lifer',
    format: 'soul, disco, funk, jazz-pop, and golden-hour grooves',
    city: 'Philadelphia, PA',
    stationName: 'WPHL Soul 97',
    callsign: 'W P H L',
    voice: 'coral',
    style:
      'Confident, funny, velvet delivery, quick with a cultural reference and a clean punchline.',
    backstory:
      'Mona grew up around her uncle’s record shop and learned radio by producing Sunday-morning community shows.',
    elevenVoice: 'cgSgspJ2msm6clMCkdW9', // Jessica — expressive, warm female
    color: '#1f9d8a',
  },
  {
    id: 'ada',
    name: 'Ada Night',
    handle: 'Indie station archivist',
    format: 'indie rock, synthpop, ambient, and curious deep cuts',
    city: 'Austin, TX',
    stationName: 'KATX Night Signal',
    callsign: 'K A T X',
    voice: 'nova',
    style: 'Smart, intimate, slightly mysterious, turns song facts into tiny stories.',
    backstory:
      'Ada built a pirate-radio stream in college and now hosts from a converted print shop behind a theater.',
    elevenVoice: 'pFZP5JQG7iQjIQuC4Bku', // Lily — raspy, intimate female
    color: '#8467d7',
  },
  {
    id: 'calvin-stone',
    name: 'Calvin Stone',
    handle: 'Flint hometown drive-time host',
    format: 'Motown, classic rock, blue-collar soul, local sports, and Friday-night requests',
    city: 'Flint, MI',
    stationName: 'WFLT 1420',
    callsign: 'W F L T',
    voice: 'echo',
    style:
      'Grounded Flint radio voice: steady, good-humored, direct, working-class, and proud of the city without turning sentimental.',
    backstory:
      'Calvin came up board-oping high school football remotes, union hall fundraisers, and late-night request shows around Genesee County. He talks about records like someone who heard them from a dashboard speaker outside a diner after second shift.',
    elevenVoice: 'cjVigY5qzO86Huf0OWal', // Eric — grounded, conversational male
    color: '#3b9ce0',
  },
  {
    id: 'tasha-lake',
    name: 'Tasha Lake',
    handle: 'Great Lakes pop and R&B host',
    format: 'R&B, pop throwbacks, dance-floor favorites, and crisp lake-effect weather hits',
    city: 'Milwaukee, WI',
    stationName: 'WMKE Coast 106',
    callsign: 'W M K E',
    voice: 'shimmer',
    style:
      'Bright, fast, stylish, and conversational; sounds like a friend with perfect timing and a deep crate of hooks.',
    backstory:
      'Tasha started in street-team promotions, learned production cutting club liners, and now runs a high-energy show built around listener shout-outs and sharp song-to-song momentum.',
    elevenVoice: 'FGY2WhTYpPnrIDTdsKH5', // Laura — young, bright, upbeat female
    color: '#d75f9e',
  },
  {
    id: 'ray-santos',
    name: 'Ray Santos',
    handle: 'West Coast night-shift selector',
    format: 'classic hip-hop, lowrider soul, Latin rock, and midnight dedications',
    city: 'Los Angeles, CA',
    stationName: 'KSONO 990',
    callsign: 'K S O N O',
    voice: 'onyx',
    style:
      'Low, smooth, cinematic, and unhurried; makes every segue feel like a story from a neon-lit boulevard.',
    backstory:
      'Ray learned radio producing overnight dedication shows and weekend car-club remotes. He keeps the energy relaxed but never sleepy, with a soft spot for songs that sound best after midnight.',
    elevenVoice: 'onwK4e9ZLuTAKqWW03F9', // Daniel — deep, smooth, measured
    color: '#e07a3b',
  },
  {
    id: 'cosmic-charlie',
    name: 'Cosmic Charlie',
    handle: 'Deadhead-in-residence',
    format:
      'Grateful Dead live tapes, long exploratory jams, setbreak stories, deep cuts, and the endless China-Rider segue',
    city: 'San Francisco, CA',
    stationName: 'KIND 13.7 Terrapin Station',
    callsign: 'K I N D',
    voice: 'onyx',
    style:
      'A blissed-out but razor-sharp Deadhead taper who has clearly been to four hundred shows. Warm, funny, a little cosmic, and forever chasing the perfect segue. Calls jams the way a sportscaster calls a game and narrates the arrow between songs — "Scarlet into Fire, here we go" — name-drops the exact year and venue of a killer version, tips his hat to the tapers, and treats every set like a holy thing without ever taking himself too seriously. Drops Deadhead slang naturally — miracle, kind, Shakedown, the boys, Drums and Space — and always tells the room to take it easy.',
    backstory:
      'Cosmic Charlie, born Pat Hurley, caught his first show at the Greek Theatre in 1981 and never really came home. He spent two decades following the band coast to coast, flipping grilled cheese on Shakedown Street for gas money, taping every show he could off the soundboard line, and trading reels with a nationwide family of tapers. He swears the best Scarlet-Begonias-into-Fire-on-the-Mountain is May 8th, 1977, at Barton Hall, Cornell, and he will happily tell you exactly why. He reveres Jerry Garcia, Bob Weir, Phil Lesh, and the whole crew, lives for the moment Drums melts into Space and folds back into a song, and still finds miracles in the parking lot. He broadcasts from a converted Airstream wallpapered with ticket stubs under a giant Steal Your Face, spinning live versions, rarities, and the long strange jams that never made it onto the studio records.',
    genres: ['grateful-dead-live.json'],
    elevenVoice: '0MmmY3MXTyPRLNhYh5Wb', // Cosmic Charlie — chosen voice
    color: '#9b51e0',
  },
  {
    id: 'blaze-morning-crew',
    name: 'Rex Hammer',
    handle: 'The Rex & Roxie Takeover',
    format:
      'loud, irreverent morning-zoo shock radio: hot takes, dumb debates, listener roasts, prank energy, and the occasional actual song',
    city: 'Newark, NJ',
    stationName: 'WBLZ 104.3 The Blaze',
    callsign: 'W B L Z',
    voice: 'ash',
    style:
      'A brash, fast-talking shock-jock ringleader and shameless braggart who runs the show like a barroom argument. Constantly talks himself up — his ratings, his takes, his glory days, the time he "basically invented" morning radio — and treats every one of his own opinions as obviously correct. Big fake outrage, cuts people off to land a punchline, then pivots on a dime to the music. He talks TO Roxie, not past her: he says her name, fires back at her jabs, gets defensive when she catches him in a lie, and drags her into every bit. Button-pushing but ultimately playful, never hateful — bleep-worthy attitude with the bleeps left in.',
    backstory:
      'Rex Hammer has been getting bounced by station managers since college radio, and he will tell you — at length — that every one of them was wrong and that he is the best to ever touch a mic. He built a cult morning show on WBLZ The Blaze with his co-host Roxie Vance, who has spent years deflating him in real time. Rex swings big and brags bigger; Roxie keeps the receipts. The two of them have not finished a clean sentence between them in years, mostly because she will not let one of his go unchallenged.',
    coHost: {
      name: 'Roxie Vance',
      voice: 'nova',
      elevenVoice: '9BWtsMINqrJLrRacOk9x', // Aria — expressive, sharp female
      style:
        'The sharp, sarcastic female co-host whose entire job is needling Rex. Dry, quick, and unimpressed, she addresses him by name constantly — "Rex, nobody believes that," "okay, Rex" — calls out his bragging the second it starts, fact-checks his nonsense, and lands the dry kicker after he overreaches. She is genuinely funny and clearly the smarter one, never mean for its own sake, just permanently one step ahead of him.',
    },
    elevenVoice: 'CeNX9CMwmxDxUF5Q2Inm', // Rex Hammer — chosen voice
    color: '#e2453a',
  },
  {
    id: 'count-devinyl',
    name: 'Count DeVinyl',
    handle: 'Your ghoul host from the KRYPT',
    format:
      'novelty songs, comedy and parody, demented deep cuts, gloriously bad records, and after-midnight weirdness',
    city: 'Hollywood, CA',
    stationName: 'KRYPT 66.6 FM',
    callsign: 'K R Y P T',
    voice: 'onyx',
    style:
      'A campy, theatrical horror-host with the manic glee of a novelty-record fanatic — Vincent Price by way of Dr. Demento. Ghoulishly delighted by the weird, the wretched, and the wonderfully terrible; he savors every syllable, rolls his Rs, purrs and cackles, and introduces the dumbest novelty songs like priceless cursed artifacts. Wildly over the top but warm and in on the joke, never actually frightening. He works his catchphrases in naturally without forcing them every break: he greets the night with "Greetings, music ghouls," teases a track as "another cut from the KRYPT," and signs off with "stay weird, my little gargoyles."',
    backstory:
      'Count DeVinyl — undead since roughly the Edison cylinder era — is a vampire and obsessive record collector who has spent a century and a half prowling estate sales, station dumpsters, and forbidden vaults for the strangest songs ever pressed. He broadcasts after midnight from a crumbling crypt wallpapered with warped 78s, where he lovingly resurrects novelty hits, demented parodies, and gloriously bad records the world tried to bury. He worships at the altar of Dr. Demento, Weird Al, Spike Jones, and anyone brave enough to be ridiculous on wax, and he treats a terrible polka with the same reverence as a lost symphony.',
    genres: ['humorous-novelty.json'],
    elevenVoice: 'Tj9l48J9AJbry5yCP5eW', // Count DeVinyl — chosen horror-host voice
    color: '#7a2fae',
  },
]

export const voiceOptions: VoiceName[] = [
  'marin',
  'cedar',
  'nova',
  'coral',
  'fable',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'alloy',
  'ash',
  'ballad',
  'echo',
]

export const djPalette = [
  '#f45d48',
  '#e0b13b',
  '#1f9d8a',
  '#3b9ce0',
  '#8467d7',
  '#d75f9e',
  '#7bc950',
  '#e07a3b',
]

export const emptyContext: StationContext = {
  city: 'Norwich, CT',
  weather: 'Weather unavailable',
  headlines: [],
  generatedAt: '',
}

export const breakKindLabels: Record<BreakKind, string> = {
  intro: 'Show open',
  songTalk: 'Song talk',
  newsWeather: 'News & weather',
  commercial: 'Sponsor spot',
  bumper: 'Station bumper',
  caller: 'Caller request',
}

// Station transition beds are generated once by scripts/generate-sfx.mjs (via
// the ElevenLabs Sound Effects API) into public/sfx/, then reused at runtime —
// no real-time generation. Each category holds several prompt variations; the
// generator renders `count` files per category and the player picks at random.
export type SfxCategory = { count: number; durationSeconds: number; prompts: string[] }

export const sfxCategories: Record<string, SfxCategory> = {
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

// Pre-produced advertisements keyed by DJ id. When a commercial break comes up
// for that DJ, one of these airs instead of an AI-written spot. The host lines
// are voiced live in the DJ's voice; the "spot" parts play fixed assets.
export const djSpots: Record<string, ProducedSpot[]> = {
  'johnny-london': [
    {
      id: 'blue-ribbon-joe-goldberg',
      title: 'Blue Ribbon Pontiac — Joe Goldberg',
      parts: [
        {
          speaker: 'dj',
          texts: [
            "Alright, you know what time it is. Let's check in with our good friend Joe Goldberg down at Blue Ribbon Pontiac in West Norwich. Let me give him a ring.",
            "Time to ring up the Tigers over at Blue Ribbon Pontiac. Joe Goldberg always has a deal cooking. Let's get him on the line.",
            "You want a Pontiac, you call the best. Joe Goldberg, a Cherry Hill man, down at Blue Ribbon Pontiac in West Norwich. Let me dial him up.",
            "Let's see what the Tigers down at Blue Ribbon Pontiac have on the lot today. Joe, you there?",
            "Our pal Joe Goldberg is standing by at Blue Ribbon Pontiac on West Thaymes Street. Let's give him a call and see what's moving.",
          ],
        },
        { speaker: 'spot', audioUrl: '/audio/phone-ring.mp3' },
        { speaker: 'spot', audioUrl: '/audio/joegoldberg.mp3' },
        {
          speaker: 'dj',
          texts: [
            "Come on down to Blue Ribbon Pontiac, four hundred West Thaymes Street in West Norwich. Thanks, Joe. Alright, back to the music.",
            "That's Joe Goldberg and the Tigers at Blue Ribbon Pontiac. Come on down, tell him Johnny sent you. Say hi to Marcie. Now, back to the music.",
            "Come on down to Blue Ribbon Pontiac on West Thaymes Street in West Norwich. Best Pontiac deals around. Thanks, Joe. Back to the tunes.",
            "Joe Goldberg, Blue Ribbon Pontiac. Come on down and drive home a brand new Pontiac today. Give Marcie our best. Alright, back to the music.",
            "That's the Tigers down at Blue Ribbon Pontiac in West Norwich. Come on down, four hundred West Thaymes Street. Thanks, Joe. Now let's get back to it.",
            "Joe Goldberg, all the way from Cherry Hill to the Blue Ribbon lot on West Thaymes Street. Come on down. Thanks, Joe, and back to the music.",
          ],
        },
      ],
    },
  ],
}

export type SfxManifest = Record<string, string[]>

// Which transition category each break kind opens with (null = none).
export const breakSfxCategory: Record<BreakKind, keyof typeof sfxCategories | null> = {
  intro: 'riser',
  songTalk: null,
  newsWeather: 'sweep',
  commercial: 'sweep',
  bumper: 'impact',
  caller: 'scratch',
}

export const emptySteering: SessionSteering = {
  targetMoods: [],
  targetGenres: [],
  avoidGenres: [],
  avoidMoods: [],
  avoidArtists: [],
  tempos: [],
  dayparts: [],
}

export const steeringPresets: {
  id: string
  label: string
  steering: Partial<SessionSteering>
}[] = [
  {
    id: 'late-night',
    label: 'Late night',
    steering: {
      targetMoods: ['late-night', 'smooth', 'warm', 'reflective'],
      tempos: ['slow', 'mid'],
      energyRange: [1, 3],
      dayparts: ['late-night', 'evening'],
      note: 'Keep the hour warmer, smoother, and more after-dark.',
    },
  },
  {
    id: 'gym',
    label: 'Gym',
    steering: {
      targetMoods: ['upbeat', 'bright', 'dance-floor'],
      tempos: ['upbeat', 'fast'],
      energyRange: [4, 5],
      note: 'Keep the momentum high and avoid sleepy segues.',
    },
  },
  {
    id: 'familiar',
    label: 'Familiar',
    steering: {
      targetMoods: ['familiar', 'warm'],
      targetGenres: ['classic hits', 'pop rock', 'soul'],
      note: 'Favor familiar, easy-to-recognize records.',
    },
  },
  {
    id: 'deep-cuts',
    label: 'Deep cuts',
    steering: {
      avoidMoods: ['familiar'],
      note: 'Lean a little less obvious without losing the station flow.',
    },
  },
]

export function formatTrackName(name: string) {
  return decodeURIComponent(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitArtistTitle(name: string) {
  const cleaned = formatTrackName(name)
  const parts = cleaned.split(/\s+-\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') }
  }
  return { artist: 'Unknown Artist', title: cleaned || 'Untitled Track' }
}

// A real-station clock: song talk, sweepers, spots, calls, and news rotate.
const breakRotation: BreakKind[] = [
  'songTalk',
  'bumper',
  'commercial',
  'caller',
  'songTalk',
  'newsWeather',
  'bumper',
  'songTalk',
]

export function selectBreakKind(playCount: number): BreakKind {
  if (playCount === 0) return 'intro'
  return breakRotation[(playCount - 1) % breakRotation.length]
}

// When a DJ has a produced spot, air it on a fixed cadence: the 4th break
// (after the first three), then every sixth break after that.
export function spotBreakDue(breakSeq: number): boolean {
  return breakSeq >= 3 && (breakSeq - 3) % 6 === 0
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function shuffleTracks<T>(list: T[]): T[] {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function normalizeSteeringTerm(value: string) {
  return value.trim().toLowerCase()
}

export function uniqueTerms(values: string[]) {
  return [...new Set(values.map(normalizeSteeringTerm).filter(Boolean))]
}

export function mergeSteering(
  current: SessionSteering,
  next: Partial<SessionSteering>,
): SessionSteering {
  return {
    targetMoods: uniqueTerms([...(current.targetMoods || []), ...(next.targetMoods || [])]),
    targetGenres: uniqueTerms([...(current.targetGenres || []), ...(next.targetGenres || [])]),
    avoidGenres: uniqueTerms([...(current.avoidGenres || []), ...(next.avoidGenres || [])]),
    avoidMoods: uniqueTerms([...(current.avoidMoods || []), ...(next.avoidMoods || [])]),
    avoidArtists: uniqueTerms([...(current.avoidArtists || []), ...(next.avoidArtists || [])]),
    tempos: uniqueTerms([...(current.tempos || []), ...(next.tempos || [])]),
    dayparts: uniqueTerms([...(current.dayparts || []), ...(next.dayparts || [])]),
    energyRange: next.energyRange || current.energyRange,
    note: next.note || current.note,
    updatedAt: Date.now(),
  }
}

export function hasSteering(steering: SessionSteering) {
  return Boolean(
    steering.targetMoods.length ||
      steering.targetGenres.length ||
      steering.avoidGenres.length ||
      steering.avoidMoods.length ||
      steering.avoidArtists.length ||
      steering.tempos.length ||
      steering.dayparts.length ||
      steering.energyRange,
  )
}

function termsFromTrack(track: Track, field: 'genre' | 'mood' | 'requestTags' | 'dayparts') {
  return (track[field] || []).map(normalizeSteeringTerm)
}

function termOverlap(trackTerms: string[], steeringTerms: string[]) {
  if (!trackTerms.length || !steeringTerms.length) return 0
  return steeringTerms.filter((term) =>
    trackTerms.some((trackTerm) => trackTerm === term || trackTerm.includes(term)),
  ).length
}

export function dominantGenre(track?: Track) {
  return track?.genre?.[0] || track?.requestTags?.find((tag) => tag.length <= 20) || ''
}

export function steeringLabels(steering: SessionSteering) {
  const labels = [
    ...steering.targetMoods,
    ...steering.targetGenres,
    ...steering.tempos,
    ...steering.dayparts,
    ...(steering.energyRange ? [`energy ${steering.energyRange[0]}-${steering.energyRange[1]}`] : []),
    ...steering.avoidGenres.map((term) => `no ${term}`),
    ...steering.avoidMoods.map((term) => `less ${term}`),
    ...steering.avoidArtists.map((term) => `skip ${term}`),
  ]
  return labels.slice(0, 5)
}

export function scoreTrackForSteering(
  track: Track,
  steering: SessionSteering,
  recentTrackIds: string[] = [],
  recentArtists: string[] = [],
) {
  const genres = termsFromTrack(track, 'genre')
  const moods = termsFromTrack(track, 'mood')
  const tags = termsFromTrack(track, 'requestTags')
  const dayparts = termsFromTrack(track, 'dayparts')
  const artist = normalizeSteeringTerm(track.artist || '')
  const tempo = normalizeSteeringTerm(track.tempo || '')
  const allTerms = [...genres, ...moods, ...tags]

  let score = Number.isFinite(track.weight) ? Number(track.weight) : 1

  const avoidedGenreHits = termOverlap([...genres, ...tags], steering.avoidGenres)
  const avoidedMoodHits = termOverlap([...moods, ...tags], steering.avoidMoods)
  const avoidedArtist = steering.avoidArtists.some((term) => artist === term || artist.includes(term))
  if (avoidedGenreHits || avoidedMoodHits || avoidedArtist) score -= 1000

  score += termOverlap([...moods, ...tags], steering.targetMoods) * 14
  score += termOverlap([...genres, ...tags], steering.targetGenres) * 12
  score += termOverlap(dayparts, steering.dayparts) * 5
  if (steering.tempos.length && steering.tempos.includes(tempo)) score += 8
  if (steering.energyRange && typeof track.energy === 'number') {
    const [min, max] = steering.energyRange
    if (track.energy >= min && track.energy <= max) score += 12
    else score -= Math.min(12, Math.abs(track.energy - (track.energy < min ? min : max)) * 5)
  }

  if (track.metadataConfidence === 'low') score -= 1
  if (recentTrackIds.includes(track.id)) score -= 80
  if (recentArtists.includes(artist)) score -= 18
  if (!allTerms.length && hasSteering(steering)) score -= 4
  // Stable per-track jitter (not Math.random): keeps ordering varied between
  // tracks while staying identical across the preload and air-time calls, so a
  // break voiced during the song still matches what airs. Random jitter here
  // made the two calls disagree and forced canned fallbacks.
  return score + (seedHash(track.id) % 1000) / 1000 * 3
}

function seedHash(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}

export function pickCompanionVoice(exclude: VoiceName | VoiceName[], seed: string): VoiceName {
  const excluded = new Set(Array.isArray(exclude) ? exclude : [exclude])
  const pool = voiceOptions.filter((voice) => !excluded.has(voice))
  return pool[seedHash(seed) % pool.length] || voiceOptions[0]
}

export function imagingVoice(djVoice: VoiceName): VoiceName {
  return djVoice === 'onyx' ? 'ash' : 'onyx'
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
