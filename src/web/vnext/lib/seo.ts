import { useEffect } from 'react';

export interface VNextSeoOptions {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Updates document title, Vietnamese lang attribute, meta description, canonical URL,
 * and OpenGraph metadata cleanly without third-party scripts.
 */
export function useVNextSeo({
  title,
  description,
  canonicalPath,
  ogType = 'website',
  ogImage = '/takolio/vnext/social/og-1200x630.webp',
}: VNextSeoOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const fullTitle = title.includes('Takolio') ? title : `${title} · Takolio`;
    document.title = fullTitle;
    document.documentElement.lang = 'vi';

    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://takolio.com';
    const canonicalHref = `${origin}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalHref });
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: `${origin}${ogImage}`,
    });
    upsertCanonical(canonicalHref);
  }, [title, description, canonicalPath, ogType, ogImage]);
}

/**
 * Consent-respecting conversion hook for G03 marketing CTAs.
 * Strictly a local-only ring buffer when consent === 'granted'; zero network beacons
 * and zero tracking when consent is absent or denied.
 */
export function trackPublicConversion(eventName: string, detail?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    const consent = localStorage.getItem('takolio_analytics_consent');
    if (consent !== 'granted') return;
    const raw = sessionStorage.getItem('takolio_consent_events');
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push({ event: eventName, detail: detail ?? {}, at: new Date().toISOString() });
    sessionStorage.setItem('takolio_consent_events', JSON.stringify(list.slice(-30)));
  } catch {
    // Ignore storage restrictions.
  }
}
