import React from 'react';
import { ArrowDown, Check, Download, ExternalLink, Globe, ShieldCheck, Smartphone, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_RELEASE, TV_APP_RELEASE } from '@/config/appRelease';
import { useSEO } from '@/hooks/useSEO';
import { trackEvent } from '@/lib/siteTracking';

const DownloadPage: React.FC = () => {
  useSEO({
    title: 'Download Cine-verse apps',
    description: 'Choose the Cine-verse app made for your Android phone, tablet, or Android TV.',
  });

  // Let the analytics event flush before the browser leaves for the APK.
  const trackDownload = (event: React.MouseEvent<HTMLAnchorElement>, label: string, fileName: string): void => {
    event.preventDefault();
    trackEvent('apk_download', { path: '/download', label });
    const url = event.currentTarget.href;
    window.setTimeout(() => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }, 450);
  };

  return (
    <div className="pb-24">
      <section className="border-b border-white/10 bg-surface">
        <div className="mx-auto max-w-[1100px] px-5 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-14">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-gold">Official Android downloads</p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="cinema-title text-4xl font-black uppercase leading-[0.95] tracking-[-0.03em] sm:text-6xl">Choose your screen.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                Pick the app made for your device. The phone app is touch-first; the TV app is built for a remote and a big screen.
              </p>
            </div>
            <Link to="/explore" className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start border border-white/20 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-gold hover:text-gold sm:self-auto">
              <Globe size={15} aria-hidden="true" /> Use web app
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5" aria-label="Choose an app for your device">
            <article className="flex min-w-0 flex-col border border-white/15 bg-background/70 p-4 sm:p-6">
              <div className="flex items-center gap-2 text-gold sm:gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center border border-gold/30 bg-gold/10 sm:h-11 sm:w-11"><Smartphone size={19} aria-hidden="true" /></span>
                <span className="text-[9px] font-black uppercase tracking-[0.15em] sm:text-[10px] sm:tracking-[0.2em]">Phone + tablet</span>
              </div>
              <h2 className="mt-4 text-xl font-black leading-tight sm:mt-5 sm:text-2xl">Android app</h2>
              <p className="mt-1 min-h-10 text-xs leading-5 text-white/45 sm:min-h-0 sm:text-sm">For Android phones and tablets. Designed for touch.</p>
              <div className="mt-4 border-y border-white/10 py-3 text-[10px] leading-5 text-white/55 sm:text-xs">
                <p><strong className="text-white">v{APP_RELEASE.version}</strong><span className="px-1.5 text-white/25">·</span>{APP_RELEASE.fileSize}</p>
                <p>Requires {APP_RELEASE.minAndroid}</p>
              </div>
              <a
                href={APP_RELEASE.apkUrl}
                download={APP_RELEASE.apkFileName}
                onClick={(event) => trackDownload(event, `mobile-${APP_RELEASE.version}`, APP_RELEASE.apkFileName)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 bg-gold px-2 text-[9px] font-black uppercase tracking-[0.08em] text-background transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-gold sm:mt-5 sm:gap-2 sm:px-4 sm:text-[11px] sm:tracking-[0.12em]"
              >
                <Download size={15} aria-hidden="true" /> Download phone APK
              </a>
              <a href="https://github.com/heisbaed/cine-verse/releases/tag/v1.2.5" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-8 items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/45 transition-colors hover:text-gold sm:text-[10px]">
                Phone release details <ExternalLink size={12} aria-hidden="true" />
              </a>
            </article>

            <article className="flex min-w-0 flex-col border border-gold/40 bg-background/70 p-4 shadow-[0_18px_60px_-40px_rgba(255,204,77,0.4)] sm:p-6">
              <div className="flex items-center gap-2 text-gold sm:gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center border border-gold/30 bg-gold/10 sm:h-11 sm:w-11"><Tv size={20} aria-hidden="true" /></span>
                <span className="text-[9px] font-black uppercase tracking-[0.15em] sm:text-[10px] sm:tracking-[0.2em]">Living room</span>
              </div>
              <h2 className="mt-4 text-xl font-black leading-tight sm:mt-5 sm:text-2xl">Cineverse TV</h2>
              <p className="mt-1 min-h-10 text-xs leading-5 text-white/45 sm:min-h-0 sm:text-sm">For Android TV only. Built for a TV remote.</p>
              <div className="mt-4 border-y border-white/10 py-3 text-[10px] leading-5 text-white/55 sm:text-xs">
                <p><strong className="text-white">v{TV_APP_RELEASE.version}</strong><span className="px-1.5 text-white/25">·</span>{TV_APP_RELEASE.fileSize}</p>
                <p>Requires {TV_APP_RELEASE.minAndroid}</p>
              </div>
              <a
                href={TV_APP_RELEASE.apkUrl}
                download={TV_APP_RELEASE.apkFileName}
                onClick={(event) => trackDownload(event, `android-tv-${TV_APP_RELEASE.version}`, TV_APP_RELEASE.apkFileName)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 bg-gold px-2 text-[9px] font-black uppercase tracking-[0.08em] text-background transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-gold sm:mt-5 sm:gap-2 sm:px-4 sm:text-[11px] sm:tracking-[0.12em]"
              >
                <Download size={15} aria-hidden="true" /> Download TV APK
              </a>
              <a href="https://github.com/heisbaed/cineverseTV/releases/tag/v1.0.0" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-8 items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/45 transition-colors hover:text-gold sm:text-[10px]">
                TV release details <ExternalLink size={12} aria-hidden="true" />
              </a>
            </article>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-white/35 sm:text-xs">
            <ShieldCheck size={14} className="shrink-0 text-emerald" aria-hidden="true" /> Official APKs from Cineverse GitHub releases. Choose the app for your device.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1100px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-gold">Install your app</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A few quick steps.</h2>
          <div className="mt-7 space-y-6">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><Smartphone size={17} className="text-gold" aria-hidden="true" /> Phone or tablet</h3>
              <ol className="mt-3 space-y-3">
                {[
                  'Download the phone APK above.',
                  'If asked, allow your browser to install apps.',
                  'Open the APK, tap Install, then launch Cine-verse.',
                ].map((step, index) => <li key={step} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm leading-6 text-white/55"><span className="font-black text-gold">0{index + 1}</span>{step}</li>)}
              </ol>
            </div>
            <div className="border-t border-white/10 pt-5">
              <h3 className="flex items-center gap-2 font-bold"><Tv size={17} className="text-gold" aria-hidden="true" /> Android TV</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">Download the TV APK on your TV or transfer it to the TV, open it with a file manager, and allow installs from that source if Android asks.</p>
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-surface p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <Smartphone className="text-gold" size={21} aria-hidden="true" />
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Phone app</p><h2 className="text-xl font-black">Release {APP_RELEASE.version}</h2></div>
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {APP_RELEASE.changelog.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs leading-5 text-white/55"><Check size={14} className="mt-0.5 shrink-0 text-gold" strokeWidth={3} aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="font-bold">Already have Cineverse?</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">Open the app, choose Update when prompted, and confirm the Android installer. Your account and saved data stay in place. No uninstall needed.</p>
            <p className="mt-2 text-xs leading-5 text-white/40">The new native player needs this one-time app upgrade. Compatible future interface and logic updates download automatically and apply on launch or restart.</p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/40">
            <span>Updated {APP_RELEASE.updatedAt}</span>
            <a href={APP_RELEASE.apkUrl} download={APP_RELEASE.apkFileName} onClick={(event) => trackDownload(event, `mobile-${APP_RELEASE.version}`, APP_RELEASE.apkFileName)} className="inline-flex min-h-10 items-center gap-2 border border-white/20 px-4 font-bold text-white/70 transition-colors hover:border-gold hover:text-gold">
              <ArrowDown size={14} aria-hidden="true" /> Download phone APK again
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pb-12 sm:px-8 sm:pb-16">
        <div className="flex flex-col gap-5 border border-white/10 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3">
            <Tv className="mt-1 shrink-0 text-gold" size={21} aria-hidden="true" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">TV app · release {TV_APP_RELEASE.version}</p>
              <h2 className="mt-1 text-xl font-black">Made for the remote.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{TV_APP_RELEASE.changelog.join(' · ')}</p>
            </div>
          </div>
          <a href="https://github.com/heisbaed/cineverseTV/releases/tag/v1.0.0" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-white/20 px-4 text-[10px] font-black uppercase tracking-wider text-white/70 transition-colors hover:border-gold hover:text-gold">
            TV release notes <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
};

export default DownloadPage;
