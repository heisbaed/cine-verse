import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  /** Absolute image URL for link-preview cards (poster/backdrop). */
  image?: string;
}

const setMeta = (selector: string, content: string): void => {
  const tag = document.querySelector(selector);
  if (tag) tag.setAttribute('content', content);
};

export function useSEO({ title, description, image }: SEOProps): void {
  useEffect(() => {
    const fullTitle = title
      ? `${title} · Cine-verse`
      : 'Cine-verse — Movies & TV Series';
    document.title = fullTitle;

    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[property="og:url"]', window.location.href);
    if (image) {
      setMeta('meta[property="og:image"]', image);
      setMeta('meta[name="twitter:image"]', image);
      setMeta('meta[name="twitter:card"]', 'summary_large_image');
    }
  }, [title, description, image]);
}
