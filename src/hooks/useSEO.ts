import { useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageSEO, SEOContext } from '@/lib/seo';
import type { SEOProps } from '@/lib/seo';

const setMeta = (selector: string, content: string): void => {
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    const match = selector.match(/\[(name|property)="([^"]+)"\]/);
    if (!match) return;
    tag.setAttribute(match[1], match[2]);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

export function useSEO(props: SEOProps): void {
  const { pathname } = useLocation();
  const collectSEO = useContext(SEOContext);
  const seo = getPageSEO(props, pathname);
  collectSEO?.(seo);

  useEffect(() => {
    document.title = seo.title;
    setMeta('meta[name="description"]', seo.description);
    setMeta('meta[name="robots"]', seo.robots);
    setMeta('meta[property="og:title"]', seo.title);
    setMeta('meta[name="twitter:title"]', seo.title);
    setMeta('meta[property="og:description"]', seo.description);
    setMeta('meta[name="twitter:description"]', seo.description);
    setMeta('meta[property="og:url"]', seo.canonical);
    setMeta('meta[property="og:image"]', seo.image);
    setMeta('meta[name="twitter:image"]', seo.image);
    setMeta('meta[name="twitter:card"]', 'summary_large_image');

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = seo.canonical;
  }, [seo.title, seo.description, seo.image, seo.canonical, seo.robots]);
}
