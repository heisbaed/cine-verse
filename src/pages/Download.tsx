import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  Globe,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { APP_RELEASE } from '@/config/appRelease';

const installSteps = [
  {
    title: 'Download',
    body: 'Tap download. The file comes straight from this site — no other page opens.',
  },
  {
    title: 'Install',
    body: 'Open the file, allow “Install from this source” once, then tap Install.',
  },
  {
    title: 'Watch',
    body: 'Open Cine-verse. No ads, no popups. Sign in only to sync your watchlist.',
  },
];

const appPoints = [
  'Home-screen app, built for daily use',
  'Movies, series, and upcoming releases',
  'Instant search with filters',
  'Watchlist synced with web',
];

const webPoints = [
  'Runs in any browser, nothing to install',
  'Add to Home Screen to use like an app',
  'Offline-ready posters and details',
  'Always up to date automatically',
];

const MinimalRow: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="mt-7 space-y-3.5">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-3">
        <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald/15 text-emerald">
          <Check size={13} strokeWidth={3} aria-hidden="true" />
        </span>
        <span className="text-[15px] leading-6 text-white/70">{item}</span>
      </li>
    ))}
  </ul>
);

const DownloadPage: React.FC = () => {
  useSEO({
    title: 'Android App and Web Version',
    description:
      'About the Cine-verse Android app and web version. Download the APK directly from this site. No ads, no popups.',
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-36 pt-10 sm:px-8 md:pb-24">
      <div className="mx-auto max-w-3xl text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[13px] font-semibold text-white/55 transition-colors hover:text-gold"
        >
          <Clapperboard size={14} aria-hidden="true" />
          Cine-verse
          <ChevronRight size={14} aria-hidden="true" />
          <span className="text-white">Download</span>
        </Link>

        <h1 className="mt-6 text-[40px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
          Movies everywhere.
          <br />
          <span className="text-white/40">App or web.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
          The Android app for your phone. The web version right here. Free
          forever — no ads, no popups.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={APP_RELEASE.apkUrl}
            download={APP_RELEASE.apkFileName}
            className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-white px-8 font-bold text-black transition-opacity hover:opacity-85"
          >
            <Download size={18} aria-hidden="true" />
            Download for Android
          </a>
          <Link
            to="/explore"
            className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-white/10 px-8 font-semibold text-white transition-colors hover:bg-white/15"
          >
            <Globe size={17} aria-hidden="true" />
            Continue on web
          </Link>
        </div>
        <p className="mt-4 text-[13px] text-white/35">
          v{APP_RELEASE.version} · {APP_RELEASE.fileSize} ·{' '}
          {APP_RELEASE.minAndroid} · Updated {APP_RELEASE.updatedAt}
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-white/[0.04] p-8 sm:p-10">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-black">
            <Smartphone size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">
            Android app
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-white/50">
            Install once. Open from your home screen.
          </p>
          <MinimalRow items={appPoints} />
          <a
            href={APP_RELEASE.apkUrl}
            download={APP_RELEASE.apkFileName}
            className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black transition-opacity hover:opacity-85"
          >
            <Download size={16} aria-hidden="true" />
            Get the APK
          </a>
        </section>

        <section className="rounded-3xl bg-white/[0.04] p-8 sm:p-10">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white">
            <Globe size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">Web app</h2>
          <p className="mt-2 text-[15px] leading-6 text-white/50">
            Nothing to install. You are already here.
          </p>
          <MinimalRow items={webPoints} />
          <Link
            to="/explore"
            className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            <Globe size={16} aria-hidden="true" />
            Open the web app
          </Link>
        </section>
      </div>

      <section className="mx-auto mt-16 max-w-4xl">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Install in three taps
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {installSteps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-3xl bg-white/[0.04] p-7"
            >
              <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/35">
                Step {index + 1}
              </p>
              <p className="mt-2 text-lg font-bold">{step.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/55">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-4xl rounded-3xl bg-white/[0.04] p-8 sm:p-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Bell size={18} className="text-white/50" aria-hidden="true" />
              What&apos;s new in v{APP_RELEASE.version}
            </h2>
            <ul className="mt-5 space-y-3">
              {APP_RELEASE.changelog.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check
                    size={15}
                    strokeWidth={3}
                    className="mt-1 shrink-0 text-emerald"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-6 text-white/60">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0 sm:w-64 sm:border-l sm:border-white/10 sm:pl-8">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck
                size={16}
                className="text-emerald"
                aria-hidden="true"
              />
              Safe to install
            </h3>
            <p className="mt-3 text-[13px] leading-6 text-white/50">
              Served from this same website and signed by the Cine-verse owner.
              Android only warns because it is not from Google Play.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DownloadPage;
