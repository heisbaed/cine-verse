import { createContext } from 'react';

export const SITE_ORIGIN = 'https://ourcineverse.web.app';
export const DEFAULT_DESCRIPTION =
  'Discover movies and TV series, watch trailers, build your watchlist, and explore global cinema on Cine-verse.';
export const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-image.png`;
export const PUBLIC_PATHS = ['/', '/explore', '/upcoming', '/global', '/download'] as const;

export interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  noindex?: boolean;
}

export interface PageSEO {
  title: string;
  description: string;
  image: string;
  canonical: string;
  robots: string;
}

export function getPageSEO(props: SEOProps, pathname: string): PageSEO {
  const path = pathname.replace(/\/+$/, '') || '/';
  const isPublic = PUBLIC_PATHS.some((publicPath) => publicPath === path)
    || /^\/(movie|tv)\/[1-9]\d*$/.test(path);

  return {
    title: props.title ? `${props.title} · Cine-verse` : 'Cine-verse — Movies & TV Series',
    description: props.description || DEFAULT_DESCRIPTION,
    image: props.image || DEFAULT_IMAGE,
    canonical: `${SITE_ORIGIN}${path}`,
    robots: props.noindex || !isPublic ? 'noindex, follow' : 'index, follow',
  };
}

// Each build-time render collects the same metadata that the browser uses.
export const SEOContext = createContext<((seo: PageSEO) => void) | null>(null);
