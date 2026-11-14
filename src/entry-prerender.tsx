import React from 'react';
import { prerender } from 'react-dom/static';
import { MemoryRouter } from 'react-router-dom';
import { dehydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Upcoming from './pages/Upcoming';
import Global from './pages/Global';
import Download from './pages/Download';
import { AuthProvider } from './contexts/AuthContext';
import {
  discoverMovies,
  getGenres,
  getMovieCredits,
  getNowPlayingMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getTrendingTVShows,
  getUpcomingMovies,
  hasApiKey,
} from './api/tmdb';
import { getPageSEO, PUBLIC_PATHS, SEOContext, SITE_ORIGIN } from './lib/seo';
import type { PageSEO } from './lib/seo';
import type { MovieResponse } from './types/tmdb';

export { getPageSEO, PUBLIC_PATHS, SITE_ORIGIN };

const publicPages: Record<string, React.ComponentType> = {
  '/': Home, '/explore': Explore, '/upcoming': Upcoming, '/global': Global, '/download': Download,
};

export async function renderPage(path: string): Promise<{
  html: string;
  seo: PageSEO;
  queryState: ReturnType<typeof dehydrate>;
}> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: false, gcTime: Infinity } },
  });

  if (!hasApiKey() && path !== '/download') {
    throw new Error('Set VITE_TMDB_API_KEY before building indexable catalog pages.');
  }

  try {
    // Fetch the actual page data. A failed catalog request must fail the build,
    // rather than publishing a loading screen as an indexable page.
    if (path === '/') {
      await Promise.all([
        queryClient.fetchQuery({ queryKey: ['trendingMovies'], queryFn: getTrendingMovies }),
        queryClient.fetchQuery({ queryKey: ['trendingTVShows'], queryFn: getTrendingTVShows }),
        queryClient.fetchQuery({ queryKey: ['nowPlayingMovies'], queryFn: getNowPlayingMovies }),
        queryClient.fetchQuery({ queryKey: ['upcomingMovies'], queryFn: getUpcomingMovies }),
        queryClient.fetchQuery({ queryKey: ['topRatedMovies'], queryFn: getTopRatedMovies }),
      ]);
      const featured = queryClient.getQueryData<MovieResponse>(['trendingMovies'])?.results[0];
      if (featured) {
        const credits = await queryClient.fetchQuery({
          queryKey: ['homeHeroCredits', featured.id],
          queryFn: () => getMovieCredits(featured.id),
        });
        queryClient.setQueryData(['homeSpotlightCredits', featured.id], credits);
      }
    } else if (path === '/explore') {
      await Promise.all([
        queryClient.fetchQuery({ queryKey: ['genres', 'movie'], queryFn: getGenres }),
        queryClient.fetchInfiniteQuery({
          queryKey: ['exploreMedia', 'movie', '', 0, '', '', '', '', 'popularity.desc'],
          initialPageParam: 1,
          queryFn: ({ pageParam }) => discoverMovies({ sort_by: 'popularity.desc', page: String(pageParam) }),
          getNextPageParam: (lastPage: MovieResponse) => lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
        }),
      ]);
    } else if (path === '/upcoming') {
      await queryClient.fetchQuery({ queryKey: ['upcomingMovies'], queryFn: getUpcomingMovies });
    } else if (path === '/global') {
      await queryClient.fetchQuery({
        queryKey: ['globalMedia', 'movie', 'Hollywood'],
        queryFn: () => discoverMovies({ with_original_language: 'en', sort_by: 'popularity.desc' }),
      });
    }
  } catch (error) {
    // Axios errors contain request credentials: never print the original object.
    const status = (error as { response?: { status?: number } }).response?.status;
    throw new Error(`Cannot prerender ${path}: TMDB request failed${status ? ` (HTTP ${status})` : ''}.`);
  }

  let seo = getPageSEO({ title: '' }, path);
  const Page = publicPages[path];
  if (!Page) throw new Error(`No public page configured for ${path}.`);
  try {
    const { prelude } = await prerender(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[path]}>
              <SEOContext.Provider value={(pageSEO) => { seo = pageSEO; }}>
                <App prerenderedPage={<Page />} />
              </SEOContext.Provider>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </React.StrictMode>,
    );
    const html = await new Response(prelude).text();
    return { html, seo, queryState: dehydrate(queryClient) };
  } finally {
    queryClient.clear();
  }
}
