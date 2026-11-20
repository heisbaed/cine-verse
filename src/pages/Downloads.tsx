import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HardDriveDownload, Play, Trash2 } from 'lucide-react';
import { deleteOfflineItem, formatBytes } from '@/api/offline';
import VideoPlayer from '@/components/sections/VideoPlayer';
import { useOfflineLibrary } from '@/hooks/useOfflineLibrary';
import { useSEO } from '@/hooks/useSEO';

export default function Downloads() {
  const items = useOfflineLibrary();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const playing = items.find((item) => item.id === playingId && item.status === 'ready');
  const saved = items.filter((item) => item.status === 'ready');
  const savedBytes = saved.reduce((bytes, item) => bytes + item.bytes, 0);

  useSEO({
    title: 'Offline downloads',
    description: 'Play movies and episodes saved for offline viewing in Cineverse.',
  });

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Remove ${title} from offline downloads?`)) return;
    setError('');
    try {
      await deleteOfflineItem(id);
    } catch {
      setError('Could not remove this download. Try again.');
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Downloads</h1>
      {saved.length > 0 && <p className="mt-2 text-sm text-white/55">{saved.length} saved · {formatBytes(savedBytes)}</p>}

      {!items.length ? (
        <div className="mt-9 rounded-3xl border border-white/10 bg-surface px-6 py-12 text-center">
          <HardDriveDownload size={32} className="mx-auto mb-4 text-gold" aria-hidden="true" />
          <h2 className="text-lg font-bold">No downloads saved here</h2>
          <p className="mt-2 text-sm text-white/55">Files you save to your device are in your browser’s Downloads folder.</p>
          <Link to="/explore" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-black">
            Browse titles <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mt-7 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
              {item.poster ? (
                <img src={item.poster} alt="" className="aspect-[2/3] w-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid aspect-[2/3] w-11 shrink-0 place-items-center rounded-lg bg-white/5 text-gold"><HardDriveDownload size={18} aria-hidden="true" /></span>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold sm:text-base">{item.title}</p>
                <p className="mt-1 text-xs text-white/55">
                  {[item.subtitle, item.status === 'ready' ? item.quality : null,
                    item.status === 'ready' ? formatBytes(item.bytes) : item.status === 'error' ? 'Interrupted' : 'Downloading',
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              {item.status === 'ready' && (
                <button type="button" onClick={() => setPlayingId(item.id)} aria-label={`Play ${item.title} offline`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 text-gold hover:bg-gold hover:text-black">
                  <Play size={17} fill="currentColor" aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => void remove(item.id, item.title)} aria-label={`Remove ${item.title}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-ruby">
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-ruby">{error}</p>}

      {playing && (
        <VideoPlayer key={playing.id} mediaKey={playing.mediaKey} poster={playing.poster} title={playing.title}
          subtitle={playing.subtitle} onClose={() => setPlayingId(null)}
          sources={[{
            id: playing.id, name: playing.source, source: playing.source, url: playing.url,
            contentType: playing.contentType, quality: playing.quality, offline: true,
            headers: {}, subtitles: [], expiresAt: Number.MAX_SAFE_INTEGER,
          }]} />
      )}
    </main>
  );
}
