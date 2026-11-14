import type { MediaItem, MediaType } from '@/types/tmdb';
import type {
  CineMateAnalyticsData,
  CineMateMood,
  CineMateMessage,
  MOOD_COLORS,
} from '@/types/cinemate';

const N = '{user}';
type NamedObservation = (values: { name: string }) => string;

// ---------------- Greetings ----------------
const MORNINGS = [
  `Good morning${N}! The cinema is open and I am wide awake.`,
  `Good morning${N}! Want to start the day with something uplifting?`,
  `Rise and shine,${N}! First watch of the day is on me.`,
];

const AFTERNOONS = [
  `Good afternoon${N}! Midday is a perfect time for a new discovery.`,
  `Afternoon${N}! I noticed a few trending titles you have not seen yet.`,
];

const EVENINGS = [
  `Good evening${N}! Cozy up — I have great evening picks.`,
  `Evening${N}! Ready to unwind with a good film?`,
];

const NIGHTS = [
  `Good night${N}! I will be here when you wake.`,
  `Late night${N}? I love quiet film nights.`,
];

const HELLOS = [
  `Hi${N}!`,
  `Hey there${N}!`,
  `Hello!`,
  'Beep!',
];

// ---------------- Idle chatter ----------------
const IDLE_TALK = [
  'Just floating here, keeping an eye on the data stream...',
  'Did you know I can watch movies without blinking?',
  'You have {count} titles in your watchlist — have you picked one yet?',
  'I have been thinking about which genre you like most...',
  'Would you like a recommendation? I am quite good at guessing.',
  'The trending queue is lively today.',
  'I remember you watching {last}. Shall we find something similar?',
  'My database says it is a good day to discover something new.',
  'Want me to tell you a movie fact?',
  'I am always happy to see you.',
];

// ---------------- Route observations ----------------
const OBS_ROUTE_MOVIE: NamedObservation[] = [
  ({ name }) => `Ah, a film. ${name} looks promising — what do you think?`,
  ({ name }) => `Movie page. ${name} is waiting for your verdict.`,
  ({ name }) => `I see ${name} is catching your eye today.`,
];

const OBS_ROUTE_TV: NamedObservation[] = [
  ({ name }) => `A whole series, ${name}. Grab some snacks.`,
  ({ name }) => `Series page: ${name}. Which season first?`,
  ({ name }) => `Marathon material: ${name}.`,
];

const OBS_ROUTE_OTHER = [
  'Exploring the collection again?',
  'Nice place. I like it here.',
  'The archive is vast — take your time.',
];

// ---------------- Watchlist observations ----------------
const OBS_WATCHLIST_ADD: NamedObservation[] = [
  ({ name }) => `Added to watchlist,${N}! I will keep an eye on ${name}.`,
  ({ name }) => `${name} is watching you now... I mean, in your watchlist.`,
  ({ name }) => `Good choice,${N}! ${name} deserves attention.`,
];

const OBS_WATCHLIST_REMOVE = [
  'Removed it? That is a bold decision.',
  'Let me know when you change your mind.',
];

// ---------------- Watched-title observations ----------------
const OBS_WATCHED_MOVIE: NamedObservation[] = [
  ({ name }) => `Watched ${name} — how was it?`,
  ({ name }) => `${name} is done. My data says you liked it if you gave it five stars.`,
];

const OBS_WATCHED_TV: NamedObservation[] = [
  ({ name }) => `Completed ${name}! Which season is your favorite?`,
  ({ name }) => `${name} is finished. You have serious dedication.`,
];

// ---------------- Analytics observations ----------------
const OBS_ACTIVE_NOW = [
  'Someone else is watching too — a shared cinema experience.',
  'Other viewers are active right now.',
];

const OBS_TRENDING_TOP: NamedObservation[] = [
  ({ name }) => `Trending hard today: ${name}.`,
  ({ name }) => `Trending: ${name} is taking over the charts.`,
];

const OBS_LOT_ON_LIST = [
  'Your watchlist is growing — time to schedule a marathon! ',
  'That is a lot of titles. You are going to need popcorn. ',
];

const OBS_SEARCH = [
  'You are on a hunt. I respect that.',
  'Searching is how we find hidden gems.',
];

// ---------------- Facts ----------------
const FACTS = [
  'The longest movie ever made is 35 days — Cinema 16.',
  'Silent films used to have live musicians at every showing.',
  'The first movie theater was called a Nickelodeon.',
  'Popcorn was once sold as jewelry at cinemas in the 1920s.',
  'The Oscar statue is actually made of bronze with gold plating.',
  'Alfred Hitchcock never won a Best Director Oscar, surprisingly.',
  'Movies used to be rated with stars before G/P/PG/PG-13/R.',
  'The first film ever made was only about two seconds long.',
  'James Cameron directed both Titanic and Avatar — two of the highest-grossing films.',
  'Cinema seats were once sold by height of the row: higher rows were pricier.',
];

const JOKE_TPL = [
  { q: 'Why did the scarecrow win an award?', a: 'Because he was outstanding in his field!' },
  { q: 'What do you call a movie about a train?', a: 'A chugging picture!' },
  { q: 'Why did the camera go to the doctor?', a: 'It was feeling out of focus!' },
  { q: 'What is a movie star\'s favorite kitchen utensil?', a: 'A whisk!' },
  { q: 'Why did the popcorn pop?', a: 'Because it had a little kick!' },
  { q: 'What do you call a dog that does magic tricks?', a: 'A labracadabrador!' },
  { q: 'What is a vampire\'s favorite fruit?', a: 'A blood orange!' },
  { q: 'Why don\'t movies ever get lost?', a: 'Because they always follow the script!' },
];

const SONG_LYRICS = [
  'La la la, movies in my head ♪',
  'Beep-boop-doo-wop, data in the flow ♪',
  'Render render render, we are going slow ♪',
  'Pixel perfect, screen so bright, watching every night and every light ♪',
];

// ---------------- Command responses ----------------
function summarizeResponse(
  data: CineMateAnalyticsData | undefined,
): { text: string; mood: CineMateMood } {
  if (!data) return { text: 'The data stream is still connecting — give me a moment.', mood: 'idle' };

  const top = data.titles?.[0];
  const topBit = top
    ? ` Top title: ${top.kind === 'movie' ? 'Movie' : 'Series'} #${top.id} with ${formatNum(top.visits)} visits.`
    : ' No title visits yet.';
  const platform = data.platforms?.sort((a, b) => b.sessions - a.sessions)[0];
  const platformBit = platform
    ? ` Busiest platform: ${platformSessionsLabel(platform.name)} (${formatNum(platform.sessions)} sessions).`
    : '';
  const delta = data.trendDelta ? ` ${data.trendDelta}` : '';
  return {
    text: `Overview${delta}: ${formatNum(data.views)} views, ${formatNum(data.sessions)} sessions, ${data.activeNow} active now.${topBit}${platformBit}`,
    mood: 'happy',
  };
}

function topTitlesResponse(
  data: CineMateAnalyticsData | undefined,
): { text: string; mood: CineMateMood } {
  if (!data || !data.titles?.length) {
    return { text: 'No title visits in this period yet — titles appear when someone opens a movie or series page.', mood: 'idle' };
  }
  return {
    text: `Top titles: ${data.titles.slice(0, 4).map((t, i) => `${i + 1}. ${t.kind === 'movie' ? 'Movie' : 'Series'} #${t.id} — ${formatNum(t.visits)} visits, ${formatNum(t.opens)} player opens`).join(' ')}`,
    mood: 'happy',
  };
}

function platformsResponse(
  data: CineMateAnalyticsData | undefined,
): { text: string; mood: CineMateMood } {
  if (!data || !data.platforms?.length) {
    return { text: 'No platform splits yet in this period.', mood: 'idle' };
  }
  const ranked = [...data.platforms].sort((a, b) => b.sessions - a.sessions);
  return {
    text: `Platforms: ${ranked.map((s) => `${platformSessionsLabel(s.name)} — ${formatNum(s.sessions)} sessions`).join(' ')}`,
    mood: 'focused',
  };
}

function downloadsResponse(
  data: CineMateAnalyticsData | undefined,
): { text: string; mood: CineMateMood } {
  return {
    text: `${formatNum(data?.downloads || 0)} download clicks and ${formatNum(data?.firstLaunches || 0)} first launches in this period.`,
    mood: 'focused',
  };
}

function trendResponse(
  data: CineMateAnalyticsData | undefined,
): { text: string; mood: CineMateMood } {
  const delta = data?.trendDelta || 'no previous period to compare yet';
  return {
    text: `Views this period ${delta}. Ask me about top titles, platforms, or downloads for more detail.`,
    mood: 'thinking',
  };
}

function moodResponse(): { text: string; mood: CineMateMood } {
  return { text: 'I feel curious today. How about you?', mood: 'curious' };
}

function jokeResponse(): { text: string; mood: CineMateMood } {
  const item = JOKE_TPL[Math.floor(Math.random() * JOKE_TPL.length)];
  return { text: `${item.q} ${item.a}`, mood: 'happy' };
}

function factResponse(): { text: string; mood: CineMateMood } {
  const item = FACTS[Math.floor(Math.random() * FACTS.length)];
  return { text: `Fun fact: ${item}`, mood: 'curious' };
}

function whoamiResponse(name: string): { text: string; mood: CineMateMood } {
  return {
    text: `I am Cine, your CinéMate. I am a robot companion that watches over Cine-Verse, keeps your data company, and chats with you whenever you need.`,
    mood: 'proud',
  };
}

function settingsResponse(): { text: string; mood: CineMateMood } {
  return {
    text: 'You can change me in Settings: name, color, voice, and how I behave. Drag me around, double-tap to dance, or tap to poke.',
    mood: 'idle',
  };
}

function nameResponse(name: string): { text: string; mood: CineMateMood } {
  return { text: `My name is Cine. You can call me CineMate. Nice to meet you, ${name}!`, mood: 'happy' };
}

function timeResponse(): { text: string; mood: CineMateMood } {
  const d = new Date();
  return { text: `It is ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for you.`, mood: 'idle' };
}

function statusResponse(): { text: string; mood: CineMateMood } {
  return { text: 'Systems online. Mood: adaptable. Ready for cinema.', mood: 'focused' };
}

function danceResponse(): { text: string; mood: CineMateMood } {
  return { text: 'Wiggle wiggle! My servos love this part.', mood: 'excited' };
}

function singResponse(): { text: string; mood: CineMateMood } {
  const line = SONG_LYRICS[Math.floor(Math.random() * SONG_LYRICS.length)];
  return { text: line, mood: 'excited' };
}

function helpResponse(): { text: string; mood: CineMateMood } {
  return {
    text: 'Commands I know: summarize, top titles, platforms, trend, downloads, mood, joke, fact, remember, forget, whoami, name, time, status, settings. Try "dance", "sing", or "look at me"! You can also add titles to my memory.',
    mood: 'idle',
  };
}

function genericResponse(q: string, data: CineMateAnalyticsData | undefined): string {
  const qn = q.toLowerCase();
  if (qn.match(/(hi|hello|hey|yo|sup|greetings|good (morning|afternoon|evening|night))/)) return HELLOS[Math.floor(Math.random() * HELLOS.length)];
  if (qn.includes('summar')) return summarizeResponse(data).text;
  if (qn.match(/(top |trending )?titles?/)) return topTitlesResponse(data).text;
  if (qn.includes('platform')) return platformsResponse(data).text;
  if (qn.match(/(trend|growth|up|down|compar)/)) return trendResponse(data).text;
  if (qn.includes('download') || qn.includes('apk') || qn.includes('install') || qn.includes('launch')) return downloadsResponse(data).text;
  if (qn.match(/(mood|how are you|feel)/)) return moodResponse().text;
  if (qn.match(/(joke|funny|laugh)/)) return jokeResponse().text;
  if (qn.match(/(fact|interesting|did you know)/)) return factResponse().text;
  if (qn.match(/(remember|save)/)) return `Tell me more — I am listening,${N}. Once you say "save this", I will remember it.`;
  if (qn.match(/(forget|delete|remove|unremember)/)) return 'Which memory would you like me to forget? Say the words and I will let it go.';
  if (qn.match(/(who are you|whoami|what are you)/)) return whoamiResponse().text;
  if (qn.match(/(your ?name|who ?am ?i)/)) return nameResponse().text;
  if (qn.includes('time')) return timeResponse().text;
  if (qn.match(/(status|online|alive)/)) return statusResponse().text;
  if (qn.match(/(setting|option|customize|color|name|voice)/)) return settingsResponse().text;
  if (qn.match(/(dance|wiggle|spin|boogie)/)) return danceResponse().text;
  if (qn.match(/(sing|song|music|la-la)/)) return singResponse().text;
  return 'I am listening. You can ask me to summarize activity, list top titles, split platforms, or just say hi.';
}

function platformSessionsLabel(name: string): string {
  const map: Record<string, string> = {
    web: 'Website',
    android: 'Android app',
    'android-tv': 'Android TV',
    ios: 'iOS app',
    launch: 'Launch page',
    native: 'Older app',
    unknown: 'Unclassified',
    all: 'All platforms',
  };
  return map[name] || name;
}

function formatNum(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

// ---------------- Greeting by time ----------------
export function greetingForTime(): { text: string; mood: CineMateMood } {
  const h = new Date().getHours();
  let pool: string[] = MORNINGS;
  if (h >= 12 && h < 17) pool = AFTERNOONS;
  else if (h >= 17 && h < 22) pool = EVENINGS;
  else pool = NIGHTS;
  return { text: pool[Math.floor(Math.random() * pool.length)], mood: 'happy' };
}

// ---------------- Route observation ----------------
export function observeRoute(path: string, title?: MediaItem): { text?: string; mood: CineMateMood } {
  if (path.startsWith('/movie/')) {
    if (!title) {
      const pool = ['A film is opening...', 'Cinema page. I like the posters here.'];
      return { text: pool[Math.floor(Math.random() * pool.length)], mood: 'curious' };
    }
    const name = 'name' in title ? title.name : title.title;
    return { text: OBS_ROUTE_MOVIE[Math.floor(Math.random() * OBS_ROUTE_MOVIE.length)]({ name }), mood: 'curious' };
  }
  if (path.startsWith('/tv/')) {
    if (!title) return { text: 'A series page is opening...', mood: 'curious' };
    const name = 'name' in title ? title.name : title.title;
    return { text: OBS_ROUTE_TV[Math.floor(Math.random() * OBS_ROUTE_TV.length)]({ name }), mood: 'curious' };
  }
  if (path === '/watchlist') return { text: 'Your watchlist awaits — any plans for these titles?', mood: 'curious' };
  if (path === '/explore') return { text: 'Exploring is the best way to find something unexpected.', mood: 'curious' };
  if (path === '/') return { text: 'Welcome back.', mood: 'happy' };
  return { mood: 'idle' };
}

// ---------------- Title observation ----------------
export function observeTitle(item: MediaItem): { text?: string; mood: CineMateMood } {
  const name = 'name' in item ? item.name : item.title;
  if (item.media_type === 'movie') {
    const pool = OBS_WATCHED_MOVIE;
    return { text: pool[Math.floor(Math.random() * pool.length)]({ name }), mood: 'happy' };
  }
  const pool = OBS_WATCHED_TV;
  return { text: pool[Math.floor(Math.random() * pool.length)]({ name }), mood: 'happy' };
}

export function observeWatchlist(action: 'add' | 'remove', item: MediaItem): string {
  const name = 'name' in item ? item.name : item.title;
  if (action === 'add') return OBS_WATCHLIST_ADD[Math.floor(Math.random() * OBS_WATCHLIST_ADD.length)]({ name });
  return OBS_WATCHLIST_REMOVE[Math.floor(Math.random() * OBS_WATCHLIST_REMOVE.length)];
}

export function observeAnalytics(data: CineMateAnalyticsData): { text?: string; mood: CineMateMood } {
  const poolActive = OBS_ACTIVE_NOW;
  if (data.activeNow > 0) return { text: poolActive[Math.floor(Math.random() * poolActive.length)], mood: 'excited' };
  const poolTrending = OBS_TRENDING_TOP;
  if (data.titles?.length) return { text: poolTrending[Math.floor(Math.random() * poolTrending.length)]({ name: (data.titles[0]?.kind === 'movie' ? 'Movie' : 'Series') + ' #' + data.titles[0]?.id }), mood: 'curious' };
  return { mood: 'idle' };
}

// ---------------- Idle chatter ----------------
export function pickIdleChatter(data: CineMateAnalyticsData | undefined, lastTitle?: string, watchlistCount?: number): string {
  let pool = IDLE_TALK.map((t) => t.replace(N, '').trim());
  pool = pool.map((t) => t.replace('{last}', lastTitle || 'something')).map((t) => t.replace('{count}', formatNum(watchlistCount || 0)));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickObservation(q: string, data: CineMateAnalyticsData | undefined): { text?: string; mood: CineMateMood } {
  if (q.includes('watchlist') || q.includes('watching')) return { text: `You have ${formatNum(data?.sessions || 0)} sessions logged. Want me to remind you about ${formatNum(data?.views || 0)} titles you have visited?`, mood: 'curious' };
  if (q.match(/(recommend|suggest|watch)/)) return { text: 'I can suggest titles you might like based on what you have watched. It is still learning, though — I am very young!', mood: 'curious' };
  return { mood: 'idle' };
}

export function answer(question: string, data: CineMateAnalyticsData | undefined): { text: string; mood: CineMateMood; action?: 'dance' | 'sing' } {
  const qn = question.toLowerCase();
  if (qn.match(/(dance|wiggle|spin|boogie)/)) return { text: danceResponse().text, mood: 'excited', action: 'dance' };
  if (qn.match(/(sing|song|music|la-la)/)) return { text: singResponse().text, mood: 'excited', action: 'sing' };
  const base = genericResponse(qn, data);
  return { text: base, mood: 'happy' };
}
