import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bookmark, Compass, Home, Search, Tv } from 'lucide-react';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const isTVExplore =
    location.pathname === '/explore' &&
    new URLSearchParams(location.search).get('type') === 'tv';

  const linkClass = (active: boolean) =>
    `flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 ${
      active ? 'text-gold' : 'text-white/45'
    }`;

  return (
    <nav
      className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-background/90 px-3 pt-2 backdrop-blur-2xl md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end">
        <Link to="/" className={linkClass(location.pathname === '/')}>
          <Home size={20} aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          to="/explore"
          className={linkClass(location.pathname === '/explore' && !isTVExplore)}
        >
          <Compass size={20} aria-hidden="true" />
          <span>Explore</span>
        </Link>
        <button
          onClick={() =>
            window.dispatchEvent(new Event('cineverse:open-search'))
          }
          className="group -mt-6 flex flex-col items-center gap-1 text-[10px] font-bold text-white focus:outline-none"
          aria-label="Search Cine-verse"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-gold to-ruby text-background shadow-[0_8px_30px_rgba(232,198,106,0.3)] transition-transform group-active:scale-95">
            <Search size={21} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span>Search</span>
        </button>
        <Link
          to="/watchlist"
          className={linkClass(location.pathname === '/watchlist')}
        >
          <Bookmark size={20} aria-hidden="true" />
          <span>Saved</span>
        </Link>
        <Link
          to="/explore?type=tv"
          className={linkClass(isTVExplore || location.pathname.startsWith('/tv/'))}
        >
          <Tv size={20} aria-hidden="true" />
          <span>Series</span>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNav;
