import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HardDriveDownload, Trash2, WifiOff } from 'lucide-react';
import { deleteOfflineItem, formatBytes, offlineStorageUsage } from '@/api/offline';
import VideoPlayer from '@/components/sections/VideoPlayer';
import { useOfflineLibrary } from '@/hooks/useOfflineLibrary';
import { useSEO } from '@/hooks/useSEO';

const Downloads: React.FC = () => {
  const items = useOfflineLibrary();
  const [selectedId, setSelectedId] = useState('');
  const [storageUsed, setStorageUsed] = useState(0);
  const selected = items.find((item) => item.id === selectedId) || items.find((item) => item.status === 'ready') || null;

  useSEO({
    title: 'Offline downloads',
    description: 'Play the movies and episodes you saved in Cine-verse without an internet connection.',
  });

  useEffect(() => {
    const refresh = () => { void offlineStorageUsage().then(setStorageUsed); };
    refresh();
    window.addEventListener('cineverse-offline-updated', refresh);
    return () => window.removeEventListener('cineverse-offline-updated', refresh);
  }, []);

  const ready = items.filter((item) => item.status === 'ready');

  return (
    <div className="min-h-screen px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-gold">Your library</p>
        <h1 className="cinema-title mt-3 text-5xl font-black sm:text-7xl">Offline downloads</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/55">
          Direct streams are saved inside this browser with their segments, keys and subtitles. Open this page while offline and press play.
        </p>

        {ready.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-surface/80 p-10 text-center">
            <HardDriveDownload size={44} className="mx-auto mb-4 text-gold/60" aria-hidden="true" />
            <h2 className="text-2xl font-black">Nothing saved yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">
              Open a movie or episode, press Download, and choose a direct source. Saved titles appear here.
            </p>
            <Link to="/explore" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-black text-black">
              Browse titles <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    selected?.id === item.id ? 'border-gold/60 bg-gold/10' : 'border-white/10 bg-surface hover:border-gold/30'
                  }`}
                >
                  <button type="button" onClick={() => setSelectedId(item.id)} className="flex w-full items-center gap-3 text-left">
                    {item.poster ? (
                      <img src={item.poster} alt="" className="h-16 w-11 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-16 w-11 place-items-center rounded-lg bg-black text-gold"><HardDriveDownload size={18} aria-hidden="true" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{item.title}</p>
                      <p className="mt-1 truncate text-[11px] text-white/40">{item.subtitle || item.source}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gold/70">
                        {item.status === 'ready' ? formatBytes(item.bytes) : item.status === 'downloading' ? `${formatBytes(item.bytes)} downloaded` : 'Failed'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteOfflineItem(item.id)}
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-ruby hover:underline"
                  >
                    <Trash2 size={13} aria-hidden="true" /> Remove
                  </button>
                </div>
              ))}
            </aside>

            <section>
              {selected?.status === 'ready' ? (
                <VideoPlayer
                  key={selected.id}
                  src={selected.url}
                  poster={selected.poster}
                  title={selected.title}
                />
              ) : (
                <div className="grid aspect-video place-items-center rounded-2xl border border-white/10 bg-surface text-white/45">
                  This download is not ready to play.
                </div>
              )}
            </section>
          </div>
        )}

        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-white/10 bg-surface/60 p-5 text-sm leading-relaxed text-white/45">
          <WifiOff size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
          <div>
            <p className="font-bold text-white/70">Storage note</p>
            <p className="mt-1">
              Browser storage is managed by your device and may be cleared automatically under pressure. {storageUsed > 0 ? `This site is currently using ${formatBytes(storageUsed)}.` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Downloads;
