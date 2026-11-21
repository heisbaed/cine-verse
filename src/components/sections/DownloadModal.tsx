import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { fileChoices, saveWebVideo, type FileChoice } from '@/api/webDownload';
import type { PlaybackRequest, PlaybackSource } from '@/types/playback';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: PlaybackRequest | null;
  title: string;
  sources: PlaybackSource[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function sortChoices(choices: FileChoice[]) {
  return [...choices].sort((a, b) => Number(Boolean(a.blocked)) - Number(Boolean(b.blocked))
    || (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
}

export default function DownloadModal({ isOpen, onClose, request, title, sources, loading, error, onRetry }: Props) {
  const [choices, setChoices] = useState<FileChoice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [bytes, setBytes] = useState(0);
  const scanned = useRef(new Set<string>());
  const probes = useRef<AbortController | null>(null);
  const transfer = useRef<AbortController | null>(null);
  const requestKey = request ? `${request.kind}:${request.tmdbId}:${request.season}:${request.episode}` : '';

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    probes.current = controller;
    scanned.current.clear();
    setChoices([]);
    setSelected(null);
    setPending(0);
    setMessage('');
    setBusy(false);
    return () => {
      controller.abort();
      transfer.current?.abort();
      transfer.current = null;
    };
  }, [isOpen, requestKey]);

  useEffect(() => {
    const signal = probes.current?.signal;
    if (!isOpen || !signal || signal.aborted) return;
    for (const source of sources) {
      if (scanned.current.has(source.url)) continue;
      scanned.current.add(source.url);
      setPending((count) => count + 1);
      const timeout = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
      void fileChoices([source], timeout).then((found) => {
        if (signal.aborted) return;
        setChoices((current) => sortChoices([...current, ...found.filter((item) => !current.some((choice) => choice.url === item.url))]));
      }).catch(() => {}).finally(() => {
        if (!signal.aborted) setPending((count) => count - 1);
      });
    }
  }, [isOpen, requestKey, sources]);

  if (!isOpen) return null;
  const choice = choices.find((item) => item.url === selected) ?? choices.find((item) => !item.blocked) ?? choices[0];
  const finding = Boolean(loading) || pending > 0;

  const save = async () => {
    if (!choice || choice.blocked || transfer.current) return;
    const controller = new AbortController();
    transfer.current = controller;
    setSelected(choice.url);
    setBusy(true);
    setBytes(0);
    setMessage('');
    try {
      const saved = await saveWebVideo(choice, title, setBytes, controller.signal);
      if (!controller.signal.aborted) setMessage(saved === undefined ? 'Download started in your browser.' : 'Download saved.');
    } catch (caught) {
      if (!controller.signal.aborted) setMessage(caught instanceof Error ? caught.message : 'Download interrupted.');
    } finally {
      if (transfer.current === controller) {
        transfer.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <div className="media-dialog media-on-dark fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label={`Download ${title}`}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <section className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-3xl border border-white/15 bg-[#141217] p-5 text-white shadow-2xl sm:p-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Download</h2>
            <p className="mt-1 line-clamp-2 text-sm text-white/60">{title}</p>
          </div>
          <button type="button" aria-label="Close download" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="quality-list my-4 flex min-h-0 flex-col gap-1 overflow-auto">
          {choices.map((item) => (
            <label key={item.url} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2 has-checked:border-gold/70 has-checked:bg-gold/10 focus-within:outline-2 focus-within:outline-gold">
              <input type="radio" name="download-quality" disabled={busy} checked={choice?.url === item.url}
                onChange={() => setSelected(item.url)} className="accent-gold" />
              <span className="flex-1 text-sm font-semibold">{item.quality}</span>
              <span className="text-xs text-white/75">{item.size ? `${(item.size / 1e6).toFixed(1)} MB` : 'Size unavailable'}</span>
            </label>
          ))}
          {!choices.length && <p className="py-3 text-sm text-white/65">{finding ? 'Finding download qualities…' : error || 'No compatible download is available.'}</p>}
        </div>

        {choice?.blocked && <p className="mb-3 text-xs text-white/60">{choice.blocked}</p>}
        {busy && <p role="status" className="mb-3 text-sm">Saving · {(bytes / 1e6).toFixed(1)} MB · Keep this tab open</p>}
        {message && <p role="status" className="mb-3 text-sm text-white/70">{message}</p>}
        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold p-3.5 font-bold text-black disabled:opacity-40"
          disabled={!choice || busy || Boolean(choice.blocked)} onClick={() => void save()}>
          <Download size={18} />{busy ? 'Saving…' : 'Download'}
        </button>
        {!choices.length && !finding && onRetry && <button type="button" className="mt-3 self-center text-sm font-semibold text-gold"
          onClick={() => { scanned.current.clear(); onRetry(); }}>Try again</button>}
      </section>
    </div>
  );
}
