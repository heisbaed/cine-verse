import React from 'react';
import {
  Bookmark,
  CalendarClock,
  Globe,
  House,
  Play,
  Search,
  Settings,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';

const IMG = 'https://image.tmdb.org/t/p';
const backdrop = (p: string) => `${IMG}/w780${p}`;
const posterUrl = (p: string, size: 'w185' | 'w342' = 'w342') =>
  `${IMG}/${size}${p}`;

const HERO = {
  backdrop: '/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg',
  title: 'Spider-Man: Brand New Day',
};

const TRENDING = [
  {
    title: 'Spider-Man: Brand New Day',
    poster: '/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg',
    rating: 7.9,
    year: '2026',
  },
  {
    title: 'The Odyssey',
    poster: '/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg',
    rating: 8.0,
    year: '2026',
  },
  {
    title: 'Resident Evil',
    poster: '/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg',
    rating: 7.3,
    year: '2026',
  },
];

const AI_RECS = [
  { title: 'Colony', poster: '/tN799oUR0f1gUKDYdMNrDaY7I51.jpg', rating: 8.1 },
  {
    title: 'Ghost in the Cell',
    poster: '/zxcMdx0w5Zmg8yZuuiS7CJ8vOea.jpg',
    rating: 7.2,
  },
  {
    title: 'The Odyssey',
    poster: '/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg',
    rating: 8.0,
  },
];

const UPCOMING = [
  {
    title: 'Resident Evil',
    date: '2026-09-16',
    poster: '/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg',
    rating: 7.3,
    votes: 342,
    overview:
      'Medical courier Bryan unwittingly finds himself fighting for survival as one fateful, horrifying night collapses around him in chaos.',
  },
  {
    title: 'Coyote vs. Acme',
    date: '2026-08-20',
    poster: '/kYDCl2y0VPvhT5eYWbMRInPoB03.jpg',
    rating: 7.5,
    votes: 488,
    overview:
      'After Acme products fail him one too many times in his dogged pursuit of the Roadrunner, Wile E. Coyote decides to hire a billboard lawyer to sue the Acme Corporation.',
  },
  {
    title: 'Colony',
    date: '2026-05-21',
    poster: '/tN799oUR0f1gUKDYdMNrDaY7I51.jpg',
    rating: 8.1,
    votes: 863,
    overview:
      'Professor Se-jeong is thrust into a bloody nightmare when a rapidly mutating virus is released during a biotech conference…',
  },
];

const GLOBAL_GRID = [
  { title: 'Spider-Man', poster: '/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg', rating: 7.9 },
  { title: 'The Odyssey', poster: '/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg', rating: 8.0 },
  { title: 'Resident Evil', poster: '/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg', rating: 7.3 },
  { title: 'Colony', poster: '/tN799oUR0f1gUKDYdMNrDaY7I51.jpg', rating: 8.1 },
  { title: 'Coyote vs. Acme', poster: '/kYDCl2y0VPvhT5eYWbMRInPoB03.jpg', rating: 7.5 },
  { title: 'Disclosure Day', poster: '/AnJ8IQJI23hNpYXVNaythu061Ru.jpg', rating: 7.5 },
];

type TabId = 'home' | 'global' | 'ai' | 'upcoming' | 'bookmarks';

const StatusBar: React.FC = () => (
  <div className="flex items-center justify-between px-5 pt-2 text-[9px] font-bold text-white">
    <span>9:41</span>
    <span className="flex items-center gap-1">
      <span className="flex items-end gap-[1px]">
        <span className="h-[3px] w-[2px] rounded-sm bg-white" />
        <span className="h-[5px] w-[2px] rounded-sm bg-white" />
        <span className="h-[7px] w-[2px] rounded-sm bg-white" />
        <span className="h-[9px] w-[2px] rounded-sm bg-gold" />
      </span>
      <span className="ml-1 h-[10px] w-[16px] rounded-[3px] border border-white/50 p-[1.5px]">
        <span className="block h-full w-[70%] rounded-[1px] bg-gold" />
      </span>
    </span>
  </div>
);

const TopBar: React.FC = () => (
  <div className="flex items-center gap-2 px-3.5 pt-2">
    <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-white/15 bg-[#14141C] px-2.5 py-1.5">
      <Search size={10} className="text-white/40" />
      <span className="text-[8px] text-white/35">Search movies & TV…</span>
    </div>
    <div className="grid h-6 w-6 place-items-center rounded-lg border border-white/15 bg-[#14141C]">
      <Settings size={11} className="text-white" />
    </div>
  </div>
);

const TabItem: React.FC<{
  active?: boolean;
  children: React.ReactNode;
  label: string;
}> = ({ active, children, label }) => (
  <div className="flex flex-1 flex-col items-center justify-end gap-1">
    <span className="flex items-end">{children}</span>
    <span
      className={`text-[6.5px] font-bold ${active ? 'text-gold' : 'text-white/40'}`}
    >
      {label}
    </span>
  </div>
);

const TabBar: React.FC<{ active: TabId }> = ({ active }) => (
  <div className="relative mt-auto flex items-center border-t border-white/15 bg-[#14141C] px-2 pb-2 pt-1.5">
    <TabItem active={active === 'home'} label="Home">
      <House size={14} className={active === 'home' ? 'text-gold' : 'text-white/40'} />
    </TabItem>
    <TabItem active={active === 'global'} label="Global">
      <Globe size={14} className={active === 'global' ? 'text-gold' : 'text-white/40'} />
    </TabItem>
    <div className="flex-1" />
    <TabItem active={active === 'upcoming'} label="Upcoming">
      <CalendarClock size={14} className={active === 'upcoming' ? 'text-gold' : 'text-white/40'} />
    </TabItem>
    <TabItem active={active === 'bookmarks'} label="Bookmarks">
      <Bookmark size={14} className={active === 'bookmarks' ? 'text-gold' : 'text-white/40'} />
    </TabItem>
    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[55%]">
      <div
        className={`grid h-[46px] w-[46px] place-items-center rounded-full border-2 ${
          active === 'ai'
            ? 'border-gold bg-gold'
            : 'border-gold bg-[#14141C]'
        }`}
      >
        <Sparkles
          size={18}
          className={active === 'ai' ? 'text-[#09090B]' : 'text-gold'}
          fill={active === 'ai' ? '#09090B' : 'transparent'}
        />
      </div>
    </div>
  </div>
);

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative mx-auto w-full max-w-[288px]">
    <div className="rounded-[34px] bg-[#151519] p-[9px] shadow-2xl shadow-black/60 ring-1 ring-white/10">
      <div className="relative aspect-[9/19.2] overflow-hidden rounded-[26px] bg-[#0A0A0E]">
        <div className="absolute left-1/2 top-1.5 z-30 h-[16px] w-[66px] -translate-x-1/2 rounded-full bg-black" />
        <div className="absolute inset-x-0 top-0 z-20">
          <StatusBar />
        </div>
        <div className="flex h-full flex-col pt-[22px]">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  </div>
);

interface MockPhoneProps {
  title: string;
  caption: string;
  children: React.ReactNode;
}

const MockPhone: React.FC<MockPhoneProps> = ({ title, caption, children }) => (
  <figure>
    <PhoneShell>{children}</PhoneShell>
    <figcaption className="mt-4 text-center">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-white/45">{caption}</p>
    </figcaption>
  </figure>
);

const HomeCard: React.FC<{
  poster: string;
  title: string;
  rating: number;
  year: string;
}> = ({ poster, title, rating, year }) => (
  <div className="w-[76px] shrink-0">
    <div className="relative overflow-hidden rounded-lg bg-white/5">
      <img
        src={posterUrl(poster)}
        alt={title}
        loading="lazy"
        className="h-[112px] w-full object-cover"
      />
      <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/70">
        <Bookmark size={8} className="text-white" />
      </span>
    </div>
    <div className="mt-1 flex items-center gap-0.5">
      <Star size={7} className="text-gold" fill="#E8C66A" />
      <span className="text-[8px] font-bold text-gold">{rating.toFixed(1)}</span>
      <span className="text-[8px] text-white/40">· {year}</span>
    </div>
    <p className="mt-0.5 line-clamp-2 text-[8px] font-semibold leading-[11px] text-white">
      {title}
    </p>
  </div>
);

export const HomeScreen: React.FC = () => (
  <>
    <TopBar />
    <div className="mx-3.5 mt-2.5 overflow-hidden rounded-2xl bg-white/5">
      <div className="relative">
        <img
          src={backdrop(HERO.backdrop)}
          alt={HERO.title}
          loading="lazy"
          className="h-[150px] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0E] via-[#0A0A0E]/0 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-[7px] font-extrabold uppercase tracking-[2px] text-gold">
            #1 Trending this week
          </p>
          <p className="mt-0.5 text-[15px] font-black leading-tight text-white">
            {HERO.title}
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5">
            <Play size={9} fill="#09090B" className="text-[#09090B]" />
            <span className="text-[9px] font-extrabold text-[#09090B]">View details</span>
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1 pb-1.5">
        <span className="h-[3px] w-[14px] rounded-full bg-gold" />
        <span className="h-[3px] w-[3px] rounded-full bg-white/20" />
        <span className="h-[3px] w-[3px] rounded-full bg-white/20" />
        <span className="h-[3px] w-[3px] rounded-full bg-white/20" />
        <span className="h-[3px] w-[3px] rounded-full bg-white/20" />
      </div>
    </div>
    <div className="mt-2.5 px-3.5">
      <p className="text-[11px] font-bold text-white">Trending movies</p>
    </div>
    <div className="mt-2 flex gap-2.5 overflow-hidden px-3.5 pb-4">
      {TRENDING.map((m) => (
        <HomeCard key={m.title} {...m} />
      ))}
    </div>
    <TabBar active="home" />
  </>
);

const AiBubble: React.FC<{
  title: string;
  text: string;
  children?: React.ReactNode;
}> = ({ title, text, children }) => (
  <div className="flex items-start gap-1.5 px-3.5">
    <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/15 bg-[#14141C]">
      <Sparkles size={9} className="text-gold" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[6.5px] font-extrabold uppercase tracking-wider text-gold">
        {title}
      </p>
      <div
        className={`mt-0.5 rounded-xl rounded-bl-sm border border-white/15 bg-[#14141C] px-3 py-2 text-[10px] leading-[15px] text-white`}
      >
        {text}
        {children}
      </div>
    </div>
  </div>
);

const CineAiScreen: React.FC = () => (
  <>
    <div className="flex flex-col items-center gap-1 pb-1.5 pt-2">
      <div className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#14141C]">
        <Wand2 size={15} className="text-gold" />
      </div>
      <p className="text-[13px] font-black text-white">Cine AI</p>
      <p className="text-[6.5px] text-white/35">
        In the middle of it all · Powered by Osbornes Digital Solutions
      </p>
    </div>
    <div className="flex flex-col gap-2 pb-3">
      <AiBubble
        title="Cine AI"
        text="Hey — I'm Cine AI, your personal movie & TV scout. Tell me a mood, a genre, or a favourite title and I'll find your next watch."
      />
      <div className="flex flex-wrap gap-1.5 px-3.5">
        {['Moody sci-fi movies', 'Something feel-good'].map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/15 bg-[#14141C] px-2.5 py-1 text-[8px] font-semibold text-white/70"
          >
            {s}
          </span>
        ))}
      </div>
      <div className="flex items-start justify-end px-3.5">
        <div className="max-w-[75%]">
          <p className="pb-0.5 text-right text-[6.5px] font-extrabold uppercase tracking-wider text-white/50">
            You
          </p>
          <div className="rounded-xl rounded-br-sm bg-gold px-3 py-2 text-[10px] font-bold leading-[15px] text-[#09090B]">
            Moody sci-fi movies, please.
          </div>
        </div>
      </div>
      <AiBubble
        title="Cine AI"
        text="Here's what fits the mood:"
      >
        <div className="mt-1.5 flex gap-1.5">
          {AI_RECS.map((m) => (
            <div key={m.title} className="w-[64px] shrink-0">
              <img
                src={posterUrl(m.poster, 'w185')}
                alt={m.title}
                loading="lazy"
                className="h-[92px] w-full rounded-md object-cover"
              />
              <p className="mt-0.5 line-clamp-1 text-[7px] font-semibold text-white">
                {m.title}
              </p>
              <p className="flex items-center gap-0.5 text-[6.5px] font-bold text-gold">
                <Star size={6} fill="#E8C66A" className="text-gold" />
                {m.rating.toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      </AiBubble>
    </div>
    <div className="mt-auto flex items-center gap-2 border-t border-white/15 px-3 py-2">
      <div className="flex-1 rounded-full border border-white/15 bg-[#14141C] px-3 py-2 text-[9px] text-white/35">
        Ask for a movie or show…
      </div>
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold">
        <Sparkles size={12} className="text-[#09090B]" fill="#09090B" />
      </div>
    </div>
    <TabBar active="ai" />
  </>
);

const UpcomingScreen: React.FC = () => (
  <>
    <TopBar />
    <p className="px-3.5 pb-1.5 pt-2 text-[14px] font-black text-white">
      Coming soon
    </p>
    <div className="flex flex-col gap-2 px-3.5 pb-4">
      {UPCOMING.map((m) => (
        <div
          key={m.title}
          className="flex gap-2.5 rounded-xl bg-[#14141C] p-2"
        >
          <img
            src={posterUrl(m.poster)}
            alt={m.title}
            loading="lazy"
            className="h-[82px] w-[54px] shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[7px] font-extrabold uppercase tracking-wider text-gold">
              {m.date}
            </p>
            <p className="mt-0.5 text-[11px] font-extrabold leading-tight text-white">
              {m.title}
            </p>
            <p className="mt-1 text-[8px] text-white/50">
              ★ {m.rating.toFixed(1)} · {m.votes} votes
            </p>
            <p className="mt-1 line-clamp-2 text-[8px] leading-[12px] text-white/40">
              {m.overview}
            </p>
          </div>
        </div>
      ))}
    </div>
    <TabBar active="upcoming" />
  </>
);

const GlobalScreen: React.FC = () => (
  <>
    <TopBar />
    <p className="px-3.5 pb-1 pt-2 text-[14px] font-black text-white">
      Around the world
    </p>
    <div className="mt-1.5 flex gap-1.5 overflow-hidden px-3.5">
      <span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-[8px] font-bold text-[#09090B]">
        English
      </span>
      {['Hindi', 'Yoruba', 'Swahili', 'Korean', 'Japanese'].map((r) => (
        <span
          key={r}
          className="shrink-0 rounded-full border border-white/15 bg-[#14141C] px-2.5 py-1 text-[8px] font-semibold text-white/60"
        >
          {r}
        </span>
      ))}
    </div>
    <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-2 overflow-hidden px-3.5 pb-4">
      {GLOBAL_GRID.map((m) => (
        <div key={m.title}>
          <img
            src={posterUrl(m.poster)}
            alt={m.title}
            loading="lazy"
            className="aspect-[2/3] w-full rounded-md object-cover"
          />
          <div className="mt-0.5 flex items-center gap-0.5">
            <Star size={6} className="text-gold" fill="#E8C66A" />
            <span className="text-[7px] font-bold text-gold">
              {m.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[7.5px] font-semibold leading-[10px] text-white">
            {m.title}
          </p>
        </div>
      ))}
    </div>
    <TabBar active="global" />
  </>
);

const AppShowcase: React.FC = () => (
  <section
    aria-label="App screens preview"
    className="mx-auto mt-24 max-w-6xl px-5 sm:px-8"
  >
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-gold">
        Inside the app
      </p>
      <h2 className="cinema-title mt-3 text-4xl font-black leading-tight sm:text-5xl">
        Built for your home screen
      </h2>
      <p className="mt-4 text-base leading-relaxed text-white/55 sm:text-lg">
        The same dark theme, gold accents, and five-tab layout from the web —
        now in your pocket. Cine AI sits right in the middle of it all.
      </p>
    </div>
    <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
      <MockPhone
        title="Home"
        caption="Hero carousel, six curated rows, and a one-tap bookmark on every card."
      >
        <HomeScreen />
      </MockPhone>
      <MockPhone
        title="Cine AI"
        caption="Ask in plain words. Titles come back as tappable cards with ratings."
      >
        <CineAiScreen />
      </MockPhone>
      <MockPhone
        title="Upcoming"
        caption="Release dates, ratings, and overviews for everything headed your way."
      >
        <UpcomingScreen />
      </MockPhone>
      <MockPhone
        title="Global"
        caption="Fourteen region tabs surface movies and shows in any language."
      >
        <GlobalScreen />
      </MockPhone>
    </div>
  </section>
);

export default AppShowcase;