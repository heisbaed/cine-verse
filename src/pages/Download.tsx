import React from 'react';
import { Check, Download, Globe, ShieldCheck, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_RELEASE } from '@/config/appRelease';
import { useSEO } from '@/hooks/useSEO';
import { trackEvent } from '@/lib/siteTracking';

const installSteps = [
  ['Download', 'Download the APK directly from Cine-verse.'],
  ['Allow', 'If Android asks, allow installation from your browser.'],
  ['Install', 'Open the APK, tap Install, then launch the app.'],
];

const screenshots = [
  { src: '/screenshots/app-home.jpg', alt: 'Cine-verse Android app home screen with trending movies', caption: 'Home' },
  { src: '/screenshots/app-featured.jpg', alt: 'Cine-verse Android app featured premiere screen', caption: 'Featured premiere' },
  { src: '/screenshots/app-detail.jpg', alt: 'Cine-verse Android app movie details screen', caption: 'Movie details' },
];

const DownloadPage: React.FC = () => {
  useSEO({
    title: 'Download Cine-verse for Android',
    description: 'Download the current Cine-verse Android APK directly or continue with the web app.',
  });

  // The browser starts the APK download immediately on click, which can abort
  // the async Firebase write. Hold navigation briefly so the apk_download
  // event flushes first, then trigger the download programmatically.
  const trackDownload = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    trackEvent('apk_download', { path: '/download', label: APP_RELEASE.version });
    const url = event.currentTarget.href;
    window.setTimeout(() => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = APP_RELEASE.apkFileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }, 450);
  };

  return (
    <div className="pb-28">
      <section className="border-b border-white/10 bg-surface">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-gold">Android release</p>
            <h1 className="cinema-title mt-4 text-5xl font-black uppercase leading-[0.9] tracking-[-0.03em] sm:text-7xl">Take Cine-verse with you.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/60 sm:text-lg">
              Install the current Android release, or keep watching in your browser. Your watchlist stays with your account.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={APP_RELEASE.apkUrl}
                download={APP_RELEASE.apkFileName}
                onClick={trackDownload}
                className="inline-flex min-h-12 items-center gap-2 bg-gold px-6 text-xs font-black uppercase tracking-[0.14em] text-background transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <Download size={17} aria-hidden="true" /> Download APK
              </a>
              <Link to="/explore" className="inline-flex min-h-12 items-center gap-2 border border-white/20 px-6 text-xs font-black uppercase tracking-[0.14em] transition-colors hover:border-gold hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold">
                <Globe size={17} aria-hidden="true" /> Use web app
              </Link>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-2 gap-x-8 gap-y-4 border-t border-white/10 pt-6 text-sm sm:grid-cols-4">
              <div><dt className="text-white/40">Version</dt><dd className="mt-1 font-bold">{APP_RELEASE.version}</dd></div>
              <div><dt className="text-white/40">Size</dt><dd className="mt-1 font-bold">{APP_RELEASE.fileSize}</dd></div>
              <div><dt className="text-white/40">Requires</dt><dd className="mt-1 font-bold">{APP_RELEASE.minAndroid}</dd></div>
              <div><dt className="text-white/40">Updated</dt><dd className="mt-1 font-bold">{APP_RELEASE.updatedAt}</dd></div>
            </dl>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3" aria-label="Cine-verse Android app screenshots">
            {screenshots.map((shot) => (
              <figure key={shot.src} className="mx-auto w-full max-w-[270px]">
                <div className="media-on-dark overflow-hidden rounded-[2.25rem] border border-white/20 bg-black p-2 shadow-2xl">
                  <img src={shot.src} alt={shot.alt} loading="lazy" className="aspect-[9/19] w-full rounded-[1.8rem] object-cover object-top" />
                </div>
                <figcaption className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.24em] text-white/45">{shot.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-gold">Installation</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Three steps on Android</h2>
            <ol className="mt-8 border-t border-white/10">
              {installSteps.map(([title, body], index) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-white/10 py-5">
                  <span className="font-black text-gold">0{index + 1}</span>
                  <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-white/50">{body}</p></div>
                </li>
              ))}
            </ol>
          </div>

          <div className="border border-white/10 bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Smartphone className="text-gold" size={22} aria-hidden="true" />
              <h2 className="text-xl font-black">Release {APP_RELEASE.version}</h2>
            </div>
            <ul className="mt-6 space-y-3">
              {APP_RELEASE.changelog.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/60">
                  <Check size={15} className="mt-1 shrink-0 text-gold" strokeWidth={3} aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 border-t border-white/10 pt-6">
              <h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-emerald" aria-hidden="true" /> Direct release file</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">The APK is served from the official Cine-verse GitHub release. Android may request permission because the app is installed outside Google Play.</p>
            </div>
            <a href={APP_RELEASE.apkUrl} download={APP_RELEASE.apkFileName} onClick={trackDownload} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-gold px-6 text-xs font-black uppercase tracking-[0.14em] text-background hover:bg-white">
              <Download size={17} aria-hidden="true" /> Download {APP_RELEASE.apkFileName}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DownloadPage;
