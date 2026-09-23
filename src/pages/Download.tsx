import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  Download,
  Globe,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import AppShowcase, {
  HomeScreen,
  PhoneShell,
} from '@/components/sections/AppShowcase';
import { getImageUrl } from '@/api/tmdb';
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

const heroBackdrop =
  '/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg';

const CheckRow: React.FC<{ items: string[] }> = ({ items }) => (
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
    <div className="pb-36 pt-10 md:pb-24">
      <section
        className="media-on-dark relative overflow-hidden text-white"
        aria-label="Download Cine-verse"
      >
        <img
          src={getImageUrl(heroBackdrop, 'original')}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-background/40" />
        <div className="hero-vignette absolute inset-0" />
        <div className="cinematic-particles absolute inset-0 opacity-40" />
        <div className="cinematic-orb cinematic-orb-gold absolute -left-24 top-1/4 h-72 w-72 rounded-full" />
        <div className="cinematic-orb cinematic-orb-ruby absolute -bottom-16 -right-24 h-80 w-80 rounded-full" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-gold sm:text-xs">
                The Android app · Get it free
              </span>
            </div>

            <h1 className="cinema-title text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Movies everywhere.
              <br />
              <span className="text-white/45">App or web.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              The Android app for your phone. The web version right here. Free
              forever — no ads, no popups.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={APP_RELEASE.apkUrl}
                download={APP_RELEASE.apkFileName}
                className="inline-flex items-center gap-3 rounded-full bg-gold px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-background shadow-[0_15px_50px_rgba(232,198,106,0.25)] transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                <Download size={18} aria-hidden="true" />
                Download for Android
              </a>
              <Link
                to="/explore"
                className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/8 px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-white backdrop-blur-xl transition-all hover:border-gold/45 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                <Globe size={18} aria-hidden="true" />
                Continue on web
              </Link>
            </div>

            <p className="mt-6 text-[13px] text-white/40">
              v{APP_RELEASE.version} · {APP_RELEASE.fileSize} ·{' '}
              {APP_RELEASE.minAndroid} · Updated {APP_RELEASE.updatedAt}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[300px] lg:max-w-none">
            <div className="absolute left-1/2 top-1/2 -z-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/20 blur-[120px]" />
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{
                repeat: Infinity,
                duration: 6,
                ease: 'easeInOut',
              }}
              className="relative z-10"
            >
              <PhoneShell>
                <HomeScreen />
              </PhoneShell>
            </motion.div>
            <div className="absolute -right-2 top-16 hidden items-center gap-2 rounded-full border border-gold/30 bg-black/50 px-3.5 py-2 text-[11px] font-bold text-gold shadow-lg backdrop-blur-xl sm:flex">
              <Sparkles size={13} aria-hidden="true" />
              Cine AI inside
            </div>
            <div className="absolute -left-2 bottom-24 hidden items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3.5 py-2 text-[11px] font-bold text-white/80 shadow-lg backdrop-blur-xl sm:flex">
              <Globe size={13} aria-hidden="true" />
              Syncs with web
            </div>
          </div>
        </div>
      </section>

      <AppShowcase />

      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-gold">
            Two ways in
          </p>
          <h2 className="cinema-title mt-3 text-4xl font-black leading-tight sm:text-5xl">
            Same cinema. Your room.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/55 sm:text-lg">
            Pick the surface that fits your day — your handset or your browser.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-surface/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold text-background">
                <Smartphone size={26} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-black tracking-tight">
                  Android app
                </h3>
                <p className="mt-1 text-[15px] text-white/50">
                  Install once. Open from your home screen.
                </p>
              </div>
            </div>
            <CheckRow items={appPoints} />
            <a
              href={APP_RELEASE.apkUrl}
              download={APP_RELEASE.apkFileName}
              className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-gold px-6 text-sm font-black uppercase tracking-[0.08em] text-background transition-transform hover:-translate-y-0.5"
            >
              <Download size={16} aria-hidden="true" />
              Get the APK
            </a>
          </section>

          <section className="rounded-3xl border border-white/10 bg-surface/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white">
                <Globe size={26} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-black tracking-tight">Web app</h3>
                <p className="mt-1 text-[15px] text-white/50">
                  Nothing to install. You are already here.
                </p>
              </div>
            </div>
            <CheckRow items={webPoints} />
            <Link
              to="/explore"
              className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition-all hover:border-gold/40 hover:text-gold"
            >
              <Globe size={16} aria-hidden="true" />
              Open the web app
            </Link>
          </section>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-gold">
            Straightforward
          </p>
          <h2 className="cinema-title mt-3 text-4xl font-black leading-tight sm:text-5xl">
            Install in three taps
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {installSteps.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-3xl border border-white/10 bg-surface/60 p-7 shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-sm font-black text-background">
                  {index + 1}
                </span>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">
                  Step {index + 1}
                </p>
              </div>
              <h3 className="mt-4 text-xl font-black">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
        <div className="rounded-3xl border border-white/10 bg-surface/60 p-8 shadow-xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="flex flex-wrap items-center gap-3 text-2xl font-black">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold text-background">
                  <Bell size={19} aria-hidden="true" />
                </span>
                What&apos;s new in v{APP_RELEASE.version}
              </h2>
              <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
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
            <div className="shrink-0 sm:w-72 sm:border-l sm:border-white/10 sm:pl-8">
              <h3 className="flex items-center gap-2 text-sm font-black">
                <ShieldCheck
                  size={17}
                  className="text-emerald"
                  aria-hidden="true"
                />
                Safe to install
              </h3>
              <p className="mt-3 text-[13px] leading-6 text-white/50">
                Served from this same website and signed by the Cine-verse
                owner. Android only warns because it is not from Google Play.
              </p>
              <div className="mt-6 rounded-2xl border border-gold/20 bg-gold/8 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-gold">
                  <Sparkles size={15} aria-hidden="true" />
                  Free forever
                </p>
                <p className="mt-1.5 text-[13px] leading-5 text-white/45">
                  No ads. No popups. No account required to watch.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DownloadPage;