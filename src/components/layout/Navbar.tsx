import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bookmark,
  Clapperboard,
  Compass,
  Download,
  Film,
  Globe2,
  Home,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type Theme = 'dark' | 'light';

const railItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/explore', label: 'Explore', icon: Compass },
  { path: '/global', label: 'Global cinema', icon: Globe2 },
  { path: '/watchlist', label: 'Watchlist', icon: Bookmark },
];

const getInitialTheme = (): Theme =>
  localStorage.getItem('cine-verse-theme') === 'light' ? 'light' : 'dark';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cine-verse-theme', theme);
  }, [theme]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/explore?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <aside className="left-rail media-on-dark fixed inset-y-0 left-0 z-[70] hidden w-[72px] flex-col items-center border-r border-gold/45 bg-[#10100f] py-4 text-white lg:flex" aria-label="Primary navigation">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-md bg-gold text-black" aria-label="Cine-verse home">
          <Film size={19} strokeWidth={2.6} aria-hidden="true" />
        </Link>
        <div className="my-5 h-px w-8 bg-gold/35" />
        <nav className="rail-track flex flex-1 flex-col items-center justify-center gap-3">
          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                title={item.label}
                className={({ isActive }) => `rail-link grid h-10 w-10 place-items-center rounded-lg border transition-colors ${isActive ? 'border-gold bg-gold text-black' : 'border-transparent text-gold/70 hover:text-gold'}`}
              >
                <Icon size={18} aria-hidden="true" />
              </NavLink>
            );
          })}
          <Link to="/download" title="Download Android app" className="rail-link grid h-10 w-10 place-items-center rounded-lg text-gold/70 hover:text-gold"><Download size={18} /></Link>
          <button onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} title="Switch theme" className="rail-link grid h-10 w-10 place-items-center rounded-lg text-gold/70 hover:text-gold">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </aside>

      <header className="sticky top-0 z-50 border-b border-white/8 bg-background/95 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3">
          <Link to="/" className="mr-1 flex items-center gap-2 text-gold lg:hidden">
            <Clapperboard size={21} />
            <span className="text-sm font-black tracking-wider">CINE-VERSE</span>
          </Link>
          <form onSubmit={submitSearch} className="relative hidden w-full max-w-72 sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search movies and series" className="h-8 w-full rounded-md border border-white/5 bg-white/8 pl-9 pr-3 text-xs outline-none placeholder:text-white/40 focus:border-gold/50" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/download" className="inline-flex h-8 items-center gap-2 rounded-md bg-gold px-2.5 text-[10px] font-black uppercase tracking-wider text-black sm:px-3" aria-label="Download Android app"><Download size={14} /><span className="hidden sm:inline">Download app</span></Link>
            <button onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} className="grid h-8 w-8 place-items-center rounded-md bg-white/8 text-white/60 hover:text-gold" aria-label="Switch theme">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-md bg-white/8 text-white/60" aria-label="Notifications"><Bell size={14} /></button>
            <button onClick={() => !user && void signInWithGoogle()} className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-gold/35 bg-white/8 text-gold" aria-label={user ? user.displayName || 'Account' : 'Sign in'}>
              {user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <UserRound size={15} />}
            </button>
            <Link to="/explore" className="grid h-8 w-8 place-items-center text-white/60 sm:hidden" aria-label="Explore titles"><Menu size={18} /></Link>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
