import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  HardDriveDownload,
  Link2,
  Play,
  Share2,
  Smartphone,
  Trash2,
  WifiOff,
} from 'lucide-react';
import VideoPlayer from '@/components/sections/VideoPlayer';
import { useSEO } from '@/hooks/useSEO';

const DOWNLOAD_CACHE = 'cineverse-downloads';
const DEMO_MOVIE_URL = '/open-movies/elephants-dream.mp4';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const getResolvedUrl = (value: string): string | null => {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const Downloads: React.FC = () => {
  const [sourceUrl, setSourceUrl] = useState(DEMO_MOVIE_URL);
  const [title, setTitle] = useState('Elephants Dream');
  const [savedOffline, setSavedOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const resolvedUrl = getResolvedUrl(sourceUrl);

  useSEO({
    title: 'Offline Downloads',
    description:
      'Download authorized direct movie files and keep Cine-verse available offline.',
  });

  const refreshDownloadState = async () => {
    if (!resolvedUrl || !('caches' in window)) {
      setSavedOffline(false);
      return;
    }
    const cache = await caches.open(DOWNLOAD_CACHE);
    setSavedOffline(!!(await cache.match(resolvedUrl)));
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      setStorageUsed(estimate.usage || null);
    }
  };

  useEffect(() => {
    void refreshDownloadState();
  }, [resolvedUrl]);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt);
  }, []);

  const saveOffline = async () => {
    if (!resolvedUrl) {
      setMessage('Enter a valid HTTP or HTTPS direct video URL.');
      return;
    }
    setBusy(true);
    setMessage('Downloading the complete movie for offline playback...');
    try {
      await navigator.storage?.persist?.();
      const response = await fetch(resolvedUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Download failed');
      const cache = await caches.open(DOWNLOAD_CACHE);
      await cache.put(resolvedUrl, response);
      setSavedOffline(true);
      setMessage('Movie downloaded. Disconnect the internet and press play to verify it.');
      await refreshDownloadState();
    } catch {
      setMessage(
        'This server blocks browser downloads. Use a direct MP4 URL with CORS enabled, or restore the included demo URL.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeOffline = async () => {
    if (!resolvedUrl) return;
    const cache = await caches.open(DOWNLOAD_CACHE);
    await cache.delete(resolvedUrl);
    setSavedOffline(false);
    setMessage('Offline copy removed.');
    await refreshDownloadState();
  };

  const downloadToDevice = async () => {
    if (!resolvedUrl) {
      setMessage('Enter a valid direct video URL first.');
      return;
    }
    setBusy(true);
    setMessage('Preparing the movie file...');
    try {
      const cache = await caches.open(DOWNLOAD_CACHE);
      const response =
        (await cache.match(resolvedUrl)) ||
        (await fetch(resolvedUrl, { mode: 'cors' }));
      if (!response.ok) throw new Error('File unavailable');
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${title.trim() || 'cineverse-movie'}.mp4`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      setMessage('Movie file sent to your device downloads.');
    } catch {
      setMessage('The source server prevented an external file download.');
    } finally {
      setBusy(false);
    }
  };

  const shareSource = async () => {
    if (!resolvedUrl) return;
    const shareData = {
      title: title || 'Cine-verse movie',
      text: 'Authorized direct movie file shared from Cine-verse.',
      url: resolvedUrl,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(resolvedUrl);
      setMessage('Direct movie URL copied to the clipboard.');
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-gold">
            Offline cinema lab
          </p>
          <h1 className="cinema-title text-5xl font-black sm:text-7xl">
            Download. Disconnect. Play.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/55">
            Save an authorized direct MP4 inside Cine-verse for offline playback,
            export it to the device, or share its direct source with another app.
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-[1fr_22rem]">
          <section className="rounded-3xl border border-white/10 bg-surface/80 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                Movie title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-base font-semibold text-white outline-none focus:border-gold/50"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                Direct MP4 URL
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none focus:border-gold/50"
                />
              </label>
            </div>

            {resolvedUrl && (
              <VideoPlayer
                key={resolvedUrl}
                src={resolvedUrl}
                title={title || 'Offline movie'}
              />
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void saveOffline()}
                disabled={busy || savedOffline}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-black text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savedOffline ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <HardDriveDownload size={18} aria-hidden="true" />
                )}
                {savedOffline ? 'Saved offline' : busy ? 'Downloading...' : 'Save offline'}
              </button>
              <button
                onClick={() => void downloadToDevice()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold transition-all hover:border-gold/40 hover:text-gold disabled:opacity-50"
              >
                <Download size={18} aria-hidden="true" /> Download file
              </button>
              <button
                onClick={() => void shareSource()}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold transition-all hover:border-gold/40 hover:text-gold"
              >
                <Share2 size={18} aria-hidden="true" /> Share source
              </button>
              {savedOffline && (
                <button
                  onClick={() => void removeOffline()}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-ruby hover:bg-ruby/10"
                >
                  <Trash2 size={17} aria-hidden="true" /> Remove
                </button>
              )}
            </div>

            {message && (
              <p className="mt-5 rounded-xl border border-white/10 bg-background/45 px-4 py-3 text-sm text-white/55">
                {message}
              </p>
            )}
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-gold/20 bg-gold/8 p-6">
              <div className="mb-3 flex items-center gap-2 text-gold">
                <Play size={18} fill="currentColor" aria-hidden="true" />
                <h2 className="font-black">Included full movie</h2>
              </div>
              <p className="text-sm leading-relaxed text-white/55">
                <strong>Elephants Dream</strong> is an open movie used here for
                download verification. It is approximately 45 MB.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-white/35">
                Licensed by the Blender Foundation under Creative Commons.
              </p>
              <button
                onClick={() => {
                  setTitle('Elephants Dream');
                  setSourceUrl(DEMO_MOVIE_URL);
                }}
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-gold hover:underline"
              >
                <Link2 size={15} aria-hidden="true" /> Restore demo source
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-surface p-6">
              <div className="mb-3 flex items-center gap-2 text-gold">
                <WifiOff size={18} aria-hidden="true" />
                <h2 className="font-black">Offline verification</h2>
              </div>
              <ol className="space-y-2 text-sm leading-relaxed text-white/50">
                <li>1. Press Save offline and wait for completion.</li>
                <li>2. Turn off Wi-Fi and mobile data.</li>
                <li>3. Refresh Cine-verse and return to Downloads.</li>
                <li>4. Press play on the saved movie.</li>
              </ol>
              {storageUsed && (
                <p className="mt-4 text-xs text-white/30">
                  Browser storage in use: {(storageUsed / 1_048_576).toFixed(1)} MB
                </p>
              )}
            </div>

            {installPrompt && (
              <button
                onClick={() => void installApp()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-ruby px-5 py-4 font-black text-background"
              >
                <Smartphone size={18} aria-hidden="true" /> Install Cine-verse
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Downloads;
