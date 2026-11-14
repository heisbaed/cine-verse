import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useWatchlistStore } from '@/store/watchlistStore';
import { cineMateCore, type CineMateState } from '@/lib/cineMateCore';
import type { CineMateMood } from '@/types/cinemate';

export const useCineMate = () => {
  const [state, setState] = useState<CineMateState>(cineMateCore.getState());
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const watchlist = useWatchlistStore((s) => s.watchlist);

  useEffect(() => {
    const unsub = cineMateCore.subscribe(() => setState(cineMateCore.getState()));
    return unsub;
  }, []);

  useEffect(() => {
    const cleanup = {
      movieTitle: undefined as { kind: 'movie'; id: number; title: string } | undefined,
      tvTitle: undefined as { kind: 'tv'; id: number; title: string } | undefined,
    };

    const extract = (path: string): { kind: 'movie' | 'tv'; id: number; title: string } | undefined => {
      const movie = /^\/movie\/(\d+)(?:\/|$)/.exec(path);
      if (movie) {
        cleanup.movieTitle = { kind: 'movie', id: Number(movie[1]), title: '' };
        cleanup.tvTitle = undefined;
        return cleanup.movieTitle;
      }
      const tv = /^\/tv\/(\d+)(?:\/|$)/.exec(path);
      if (tv) {
        cleanup.tvTitle = { kind: 'tv', id: Number(tv[1]), title: '' };
        cleanup.movieTitle = undefined;
        return cleanup.tvTitle;
      }
      cleanup.movieTitle = undefined;
      cleanup.tvTitle = undefined;
      return undefined;
    };

    const path = location.pathname;
    if (path !== prevPathRef.current) {
      prevPathRef.current = path;
      const title = extract(path);
      if (title) {
        cineMateCore.onTitleViewed(title);
      } else {
        cineMateCore.onRouteChange(path);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (state.watchlistCount !== watchlist.length) {
      state.watchlistCount = watchlist.length;
      cineMateCore.onWatchlistChange();
    }
  }, [watchlist.length]);

  const send = useCallback((input: string) => {
    if (!input.trim()) return;
    const reply = cineMateCore.sendInput(input.trim());
    setState(cineMateCore.getState());
    return reply;
  }, []);

  const setMood = useCallback((mood: CineMateMood) => {
    cineMateCore.setMood(mood);
    setState(cineMateCore.getState());
  }, []);

  const poke = useCallback(() => {
    cineMateCore.handlePoke();
    setState(cineMateCore.getState());
  }, []);

  const dance = useCallback(() => {
    cineMateCore.setSyncAction('dance');
    setState(cineMateCore.getState());
  }, []);

  const sing = useCallback(() => {
    cineMateCore.setSyncAction('sing');
    setState(cineMateCore.getState());
  }, []);

  const openChat = useCallback(() => {
    cineMateCore.openChat();
    setState(cineMateCore.getState());
  }, []);

  const closeChat = useCallback(() => {
    cineMateCore.closeChat();
    setState(cineMateCore.getState());
  }, []);

  return {
    ...state,
    send,
    setMood,
    poke,
    dance,
    sing,
    openChat,
    closeChat,
  };
};

export const useCineMateAnalytics = () => {
  const [data, setData] = useState(cineMateCore.getState().analytics);

  useEffect(() => {
    const unsub = cineMateCore.subscribe(() => {
      setData(cineMateCore.getState().analytics);
    });
    return unsub;
  }, []);

  return data;
};
