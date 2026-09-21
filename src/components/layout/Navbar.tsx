import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  Clock3,
  Cloud,
  CloudOff,
  Compass,
  Download,
  Flame,
  Globe2,
  Home,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Tv,
  UserRound,
  X,
} from 'lucide-react';
import {
  getImageUrl,
  getTrendingMovies,
  getTrendingTVShows,
  hasApiKey,
  searchMovies,
  searchPeople,
  searchTVShows,
} from '@/api/tmdb';
import { useDebounce } from '@/hooks/useDebounce';
import type { MediaItem, MediaResponse, Person } from '@/types/tmdb';
import { getMediaDate, getMediaTitle, getMediaType } from '@/utils/media';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/explore', label: 'Explore', icon: Compass },
  { path: '/explore?type=tv', label: 'TV Series', icon: Tv },
  { path: '/upcoming', label: 'Upcoming', icon: CalendarDays },
  { path: '/global', label: 'Global Cinema', icon: Globe2 },
  { path: '/watchlist', label: 'My Watchlist', icon: Bookmark },
  { path: '/download', label: 'Get Android App', icon: Download },
];

const genreItems = [
  { id: 28, label: 'Action' },
  { id: 12, label: 'Adventure' },
  { id: 16, label: 'Animation' },
  { id: 35, label: 'Comedy' },
  { id: 18, label: 'Drama' },
  { id: 27, label: 'Horror' },
  { id: 878, label: 'Sci-Fi' },
  { id: 53, label: 'Thriller' },
];

const tvGenreItems = [
  { id: 10759, label: 'Action & Adventure' },
  { id: 16, label: 'Animation' },
  { id: 35, label: 'Comedy' },
  { id: 80, label: 'Crime' },
  { id: 18, label: 'Drama' },
  { id: 9648, label: 'Mystery' },
  { id: 10765, label: 'Sci-Fi & Fantasy' },
];

type Theme = 'dark' | 'light';
const SEARCH_HISTORY_KEY = 'cine-verse-search-history';

const getInitialSearchHistory = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};

const getInitialTheme = (): Theme =>
  localStorage.getItem('cine-verse-theme') === 'light' ? 'light' : 'dark';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    authLoading,
    authError,
    syncStatus,
    signInWithGoogle,
    logOut,
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'movie' | 'tv'>('movie');
  const [searchHistory, setSearchHistory] = useState<string[]>(
    getInitialSearchHistory,
  );
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const debouncedSearch = useDebounce(searchQuery.trim(), 250);

  const { data: suggestionsData, isFetching: suggestionsLoading } =
    useQuery<MediaResponse>({
      queryKey: ['navbarSearch', searchType, debouncedSearch],
      queryFn: async () =>
        searchType === 'tv'
          ? await searchTVShows(debouncedSearch)
          : await searchMovies(debouncedSearch),
      enabled:
        searchOpen && debouncedSearch.length >= 2 && hasApiKey(),
    });

  const { data: trendingData } = useQuery<MediaResponse>({
    queryKey: ['navbarTrending', searchType],
    queryFn: async () =>
      searchType === 'tv'
        ? await getTrendingTVShows()
        : await getTrendingMovies(),
    enabled: searchOpen && hasApiKey(),
  });

  const { data: peopleSuggestions, isFetching: peopleSuggestionsLoading } =
    useQuery({
      queryKey: ['navbarPeopleSearch', debouncedSearch],
      queryFn: () => searchPeople(debouncedSearch),
      enabled:
        searchOpen && debouncedSearch.length >= 2 && hasApiKey(),
    });

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    window.addEventListener('cineverse:open-search', openSearch);
    return () =>
      window.removeEventListener('cineverse:open-search', openSearch);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cine-verse-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [menuOpen, searchOpen]);

  const rememberSearch = (value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;
    setSearchHistory((current) => {
      const next = [
        normalizedValue,
        ...current.filter(
          (item) => item.toLowerCase() !== normalizedValue.toLowerCase(),
        ),
      ].slice(0, 6);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const openMedia = (item: MediaItem) => {
    const title = getMediaTitle(item);
    rememberSearch(title);
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/${getMediaType(item)}/${item.id}`);
  };

  const openPerson = (person: Person) => {
    rememberSearch(person.name);
    setSearchOpen(false);
    setSearchQuery('');
    navigate(
      `/explore?person=${person.id}&personName=${encodeURIComponent(person.name)}${searchType === 'tv' ? '&type=tv' : ''}`,
    );
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    rememberSearch(query);
    setSearchOpen(false);
    navigate(
      `/explore?q=${encodeURIComponent(query)}${searchType === 'tv' ? '&type=tv' : ''}`,
    );
  };

  return (
    <>
      <nav
        className="sticky top-0 z-50 border-b border-white/10 bg-background/75 px-4 py-3 backdrop-blur-2xl sm:px-6"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center">
          <button
            className="group flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 p-2.5 text-white transition-all hover:border-gold/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:px-4"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="navigation-drawer"
          >
            <Menu size={21} aria-hidden="true" />
            <span className="hidden text-xs font-bold uppercase tracking-[0.2em] sm:inline">
              Browse
            </span>
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg text-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
            aria-label="Cine-verse home"
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-gold/30 bg-gold/10">
              <Clapperboard size={21} aria-hidden="true" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-ruby" />
            </span>
            <span className="hidden text-xl font-black tracking-tight sm:inline">
              CINE<span className="text-white">VERSE</span>
            </span>
          </Link>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:border-gold/40 hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
              aria-label="Search movies"
            >
              <Search size={19} aria-hidden="true" />
            </button>
            <button
              onClick={() =>
                setTheme((current) =>
                  current === 'dark' ? 'light' : 'dark',
                )
              }
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:border-gold/40 hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <Sun size={19} aria-hidden="true" />
              ) : (
                <Moon size={19} aria-hidden="true" />
              )}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="hidden h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-white transition-all hover:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:grid"
              aria-label={user ? `Open profile for ${user.displayName}` : 'Open account menu'}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserRound size={19} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
            />
            <motion.aside
              id="navigation-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="absolute inset-y-0 left-0 w-[88vw] max-w-sm overflow-y-auto border-r border-white/10 bg-surface p-6 shadow-2xl"
              aria-label="Browse Cine-verse"
            >
              <div className="mb-10 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3 text-gold">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-gold/30 bg-gold/10">
                    <Clapperboard size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="font-black tracking-wide">CINE-VERSE</div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">
                      Your movie universe
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
                  aria-label="Close menu"
                >
                  <X size={21} aria-hidden="true" />
                </button>
              </div>

              <div className="mb-8 rounded-2xl border border-white/10 bg-background/45 p-4">
                {authLoading ? (
                  <div className="flex items-center gap-3 text-sm text-white/45">
                    <LoaderCircle
                      size={18}
                      className="animate-spin text-gold"
                      aria-hidden="true"
                    />
                    Checking your account...
                  </div>
                ) : user ? (
                  <div>
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt=""
                          className="h-11 w-11 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/10 text-gold">
                          <UserRound size={21} aria-hidden="true" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {user.displayName || 'Cine-verse member'}
                        </p>
                        <p className="truncate text-xs text-white/35">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                      <span
                        className={`flex items-center gap-2 text-xs font-semibold ${
                          syncStatus === 'offline'
                            ? 'text-ruby'
                            : 'text-emerald'
                        }`}
                      >
                        {syncStatus === 'syncing' ? (
                          <LoaderCircle
                            size={14}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : syncStatus === 'offline' ? (
                          <CloudOff size={14} aria-hidden="true" />
                        ) : (
                          <Cloud size={14} aria-hidden="true" />
                        )}
                        {syncStatus === 'syncing'
                          ? 'Syncing'
                          : syncStatus === 'offline'
                            ? 'Saved locally'
                            : 'Cloud synced'}
                      </span>
                      <button
                        onClick={() => void logOut()}
                        className="flex items-center gap-1.5 text-xs font-bold text-white/45 transition-colors hover:text-ruby"
                      >
                        <LogOut size={14} aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold">Take your list anywhere</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/40">
                      Sign in to sync saved titles and viewing history across devices.
                    </p>
                    <button
                      onClick={() => void signInWithGoogle()}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-black text-background transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gold/50"
                    >
                      <LogIn size={17} aria-hidden="true" />
                      Continue with Google
                    </button>
                  </div>
                )}
                {authError && (
                  <p className="mt-3 text-xs leading-relaxed text-ruby">
                    {authError}
                  </p>
                )}
              </div>

              <div className="mb-9">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-gold/60">
                  Navigation
                </p>
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isTVLink = item.path.includes('type=tv');
                    const isExploreLink = item.path === '/explore';
                    const isActive = isTVLink
                      ? location.pathname === '/explore' &&
                        new URLSearchParams(location.search).get('type') === 'tv'
                      : isExploreLink
                        ? location.pathname === '/explore' &&
                          new URLSearchParams(location.search).get('type') !== 'tv'
                        : location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 font-bold transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 ${
                          isActive
                            ? 'bg-gold text-background'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon size={19} aria-hidden="true" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles size={14} className="text-gold" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold/60">
                    Browse genres
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {genreItems.map((genre) => (
                    <Link
                      key={genre.id}
                      to={`/explore?genre=${genre.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 transition-all hover:border-gold/40 hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
                    >
                      {genre.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Tv size={14} className="text-ruby" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-ruby/70">
                    TV genres
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tvGenreItems.map((genre) => (
                    <Link
                      key={genre.id}
                      to={`/explore?type=tv&genre=${genre.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 transition-all hover:border-ruby/45 hover:text-ruby focus:outline-none focus:ring-2 focus:ring-ruby/50"
                    >
                      {genre.label}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="fixed inset-0 z-[90] overflow-y-auto bg-background/95 px-4 pb-28 pt-20 backdrop-blur-2xl sm:px-6 sm:pt-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search movies"
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-gold">
                    Find your next story
                  </p>
                  <h2 className="mt-2 text-3xl font-black sm:text-5xl">
                    Search Cine-verse
                  </h2>
                </div>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold/50"
                  aria-label="Close search"
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>

              <div className="mb-4 flex gap-2" role="tablist" aria-label="Search type">
                <button
                  onClick={() => setSearchType('movie')}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all ${
                    searchType === 'movie'
                      ? 'bg-gold text-background'
                      : 'bg-white/5 text-white/50 hover:text-white'
                  }`}
                  role="tab"
                  aria-selected={searchType === 'movie'}
                >
                  Movies
                </button>
                <button
                  onClick={() => setSearchType('tv')}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all ${
                    searchType === 'tv'
                      ? 'bg-gold text-background'
                      : 'bg-white/5 text-white/50 hover:text-white'
                  }`}
                  role="tab"
                  aria-selected={searchType === 'tv'}
                >
                  TV Series
                </button>
              </div>

              <form onSubmit={handleSearch} className="relative">
                <Search
                  size={24}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-gold"
                  aria-hidden="true"
                />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`${searchType === 'tv' ? 'Series' : 'Movie'} title, actor, or story...`}
                  className="w-full rounded-2xl border border-white/15 bg-surface py-5 pl-14 pr-28 text-lg text-white shadow-2xl outline-none transition-all placeholder:text-white/30 focus:border-gold/60 sm:text-xl"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-gold px-5 py-3 text-sm font-black text-background transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  SEARCH
                </button>
              </form>
              <p className="mt-3 text-sm text-white/35">
                Type at least two characters for instant suggestions.
              </p>

              {debouncedSearch.length >= 2 ? (
                <div className="mt-7" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-gold/70">
                      Instant suggestions
                    </p>
                    {(suggestionsLoading || peopleSuggestionsLoading) && (
                      <LoaderCircle
                        size={17}
                        className="animate-spin text-gold"
                        aria-label="Loading suggestions"
                      />
                    )}
                  </div>
                  {peopleSuggestions?.results.length ? (
                    <div className="mb-4">
                      <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                        <UserRound size={13} aria-hidden="true" /> People
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {peopleSuggestions.results.slice(0, 5).map((person) => (
                          <button
                            key={person.id}
                            onClick={() => openPerson(person)}
                            className="flex min-w-44 items-center gap-3 rounded-2xl border border-white/10 bg-surface/75 p-2.5 text-left transition-all hover:border-gold/40"
                          >
                            {person.profile_path ? (
                              <img
                                src={getImageUrl(person.profile_path, 'w185')}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/30">
                                <UserRound size={18} aria-hidden="true" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">
                                {person.name}
                              </span>
                              <span className="text-[11px] text-white/35">
                                {person.known_for_department || 'Acting'}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface/75">
                    {suggestionsData?.results.slice(0, 6).map((item) => {
                      const title = getMediaTitle(item);
                      const date = getMediaDate(item);
                      return (
                        <button
                          key={`${getMediaType(item)}-${item.id}`}
                          onClick={() => openMedia(item)}
                          className="flex w-full items-center gap-4 border-b border-white/5 p-3 text-left transition-colors last:border-b-0 hover:bg-white/5 focus:bg-white/5 focus:outline-none"
                        >
                          <img
                            src={getImageUrl(item.poster_path, 'w185')}
                            alt=""
                            className="h-16 w-11 flex-shrink-0 rounded-lg object-cover"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">
                              {title}
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-xs text-white/40">
                              <span className="uppercase text-gold/70">
                                {getMediaType(item) === 'tv' ? 'Series' : 'Movie'}
                              </span>
                              <span>{date?.split('-')[0] || 'TBA'}</span>
                              <span>★ {item.vote_average.toFixed(1)}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {!suggestionsLoading &&
                      !peopleSuggestionsLoading &&
                      suggestionsData?.results.length === 0 &&
                      peopleSuggestions?.results.length === 0 && (
                        <p className="px-5 py-8 text-center text-sm text-white/40">
                          No matching titles found.
                        </p>
                      )}
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid gap-8 sm:grid-cols-2">
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock3 size={15} className="text-gold" aria-hidden="true" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                          Recent searches
                        </h3>
                      </div>
                      {searchHistory.length > 0 && (
                        <button
                          onClick={clearSearchHistory}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 transition-colors hover:text-ruby"
                        >
                          <Trash2 size={12} aria-hidden="true" /> Clear
                        </button>
                      )}
                    </div>
                    {searchHistory.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {searchHistory.map((term) => (
                          <button
                            key={term}
                            onClick={() => setSearchQuery(term)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition-all hover:border-gold/40 hover:text-gold"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/30">
                        Your searches will appear here.
                      </p>
                    )}
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Flame size={15} className="text-ruby" aria-hidden="true" />
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Trending now
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {trendingData?.results.slice(0, 5).map((item, index) => (
                        <button
                          key={`${getMediaType(item)}-${item.id}`}
                          onClick={() => openMedia(item)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                        >
                          <span className="w-5 text-sm font-black text-gold/50">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/70">
                            {getMediaTitle(item)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
