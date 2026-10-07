import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownWideNarrow, Copy, Download, Magnet, X } from 'lucide-react';
import { getTorrentPackages } from '@/api/torrents';
import { trackEvent } from '@/lib/siteTracking';

type SortKey = 'seeds' | 'quality' | 'size-asc' | 'size-desc';

const SORT_LABELS: Record<SortKey, string> = {
  seeds: 'Most seeds',
  quality: 'Best quality',
  'size-asc': 'Smallest first',
  'size-desc': 'Largest first',
};

const resolutionRank = (resolution: string): number => {
  const match = resolution.match(/(\d{3,4})p/);
  if (match) return parseInt(match[1], 10);
  if (/4k|2160/i.test(resolution)) return 2160;
  if (/dvdscr/i.test(resolution)) return 400;
  if (/hdts|telesync/i.test(resolution)) return 300;
  if (/cam/i.test(resolution)) return 200;
  return 0;
};

interface TorrentModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieTitle: string;
  imdbId?: string | null;
  year?: string;
}

const TorrentModal: React.FC<TorrentModalProps> = ({
  isOpen,
  onClose,
  movieTitle,
  imdbId,
  year,
}) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['torrentPackages', imdbId || movieTitle, year],
    queryFn: () => getTorrentPackages({ imdbId, title: movieTitle, year }),
    enabled: isOpen,
    staleTime: 1000 * 60 * 30,
  });
  const [sort, setSort] = useState<SortKey>('seeds');
  const [resolution, setResolution] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const allPackages = data?.packages || [];
  const bayAvailable = data?.bayAvailable ?? true;
  const resolutions = useMemo(
    () =>
      Array.from(
        new Set(allPackages.map((pkg) => pkg.resolution).filter(Boolean)),
      ).sort((a, b) => resolutionRank(a) - resolutionRank(b)),
    [allPackages],
  );
  const sources = useMemo(
    () => Array.from(new Set(allPackages.map((pkg) => pkg.source))),
    [allPackages],
  );
  const packages = useMemo(() => {
    const filtered = allPackages.filter(
      (pkg) =>
        (resolution === 'all' || pkg.resolution === resolution) &&
        (source === 'all' || pkg.source === source),
    );
    switch (sort) {
      case 'quality':
        return filtered.sort(
          (a, b) => resolutionRank(b.resolution) - resolutionRank(a.resolution),
        );
      case 'size-asc':
        return filtered.sort((a, b) => a.sizeBytes - b.sizeBytes);
      case 'size-desc':
        return filtered.sort((a, b) => b.sizeBytes - a.sizeBytes);
      case 'seeds':
      default:
        return filtered.sort((a, b) => b.seeds - a.seeds);
    }
  }, [allPackages, resolution, source, sort]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(packages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = packages.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [movieTitle, resolution, source, sort, allPackages.length]);

  if (!isOpen) return null;

  const copyMagnet = async (magnetUrl: string) => {
    trackEvent('cta_click', { label: 'torrent-copy' });
    await navigator.clipboard.writeText(magnetUrl);
  };

  const trackTorrentTap = (action: 'torrent-file' | 'torrent-magnet', quality: string) => {
    trackEvent('cta_click', { label: `${action} ${quality}`.slice(0, 80) });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="media-on-dark fixed inset-0 z-[100] flex items-end justify-center bg-black/85 px-4 pb-6 text-white backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Download ${movieTitle}`}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/25 bg-[#101010] p-5 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close downloads"
            >
              <X size={18} />
            </button>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">
              Torrent packages
            </p>
            <h2 className="mt-2 pr-10 text-2xl font-black leading-tight">
              {movieTitle}
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/50">
              Pick a quality. The .torrent file opens in your torrent client,
              or copy the magnet link instead.
            </p>

            {!isLoading && !isError && allPackages.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ArrowDownWideNarrow
                    size={14}
                    className="text-gold"
                    aria-hidden="true"
                  />
                  <label
                    htmlFor="torrent-sort"
                    className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45"
                  >
                    Sort
                  </label>
                  <select
                    id="torrent-sort"
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as SortKey)
                    }
                    className="min-h-9 rounded-lg border border-white/15 bg-black px-3 text-xs font-bold text-white outline-none focus:border-gold"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                      <option key={key} value={key}>
                        {SORT_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  <span className="ml-auto text-[10px] font-bold text-white/40">
                    {packages.length} result{packages.length === 1 ? '' : 's'}
                    {totalPages > 1 ? ` · page ${safePage} of ${totalPages}` : ''}
                  </span>
                </div>
                {resolutions.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="torrent-quality"
                      className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45"
                    >
                      Quality
                    </label>
                    <select
                      id="torrent-quality"
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                      className="min-h-9 rounded-lg border border-white/15 bg-black px-3 text-xs font-bold text-white outline-none focus:border-gold"
                    >
                      <option value="all">All qualities</option>
                      {resolutions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {sources.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="torrent-source"
                      className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45"
                    >
                      Server
                    </label>
                    <select
                      id="torrent-source"
                      value={source}
                      onChange={(event) => setSource(event.target.value)}
                      className="min-h-9 rounded-lg border border-white/15 bg-black px-3 text-xs font-bold text-white outline-none focus:border-gold"
                    >
                      <option value="all">All servers</option>
                      {sources.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!bayAvailable && (
                  <p className="text-[11px] leading-4 text-white/40">
                    Extra indexes unreachable from this network — showing
                    limited results only.
                  </p>
                )}
              </div>
            )}

            {isLoading && (
              <div className="grid place-items-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-gold" />
                <p className="mt-4 text-xs font-bold text-white/50">
                  Finding available packages…
                </p>
              </div>
            )}

            {!isLoading && isError && (
              <div className="mt-6 rounded-xl border border-white/10 p-6 text-center">
                <p className="text-sm font-bold">Could not load packages.</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 rounded-lg bg-gold px-5 py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-white"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !isError && allPackages.length === 0 && (
              <div className="mt-6 rounded-xl border border-white/10 p-6 text-center">
                <p className="text-sm font-bold">No torrent packages found.</p>
                <p className="mt-2 text-xs leading-5 text-white/50">
                  This title has no indexed releases yet. Try the trailer or
                  check back after release.
                </p>
              </div>
            )}

            {!isLoading && !isError && packages.length === 0 && allPackages.length > 0 && (
              <div className="mt-6 rounded-xl border border-white/10 p-6 text-center">
                <p className="text-sm font-bold">No packages match.</p>
                <p className="mt-2 text-xs leading-5 text-white/50">
                  Try a different quality filter.
                </p>
              </div>
            )}

            {!isLoading && pageItems.length > 0 && (
              <ul className="mt-6 space-y-3">
                {pageItems.map((pkg) => (
                  <li
                    key={pkg.magnetUrl}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-gold px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-black">
                        {pkg.quality}
                      </span>
                      <span className="rounded-md border border-white/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/45">
                        {pkg.source}
                      </span>
                      <span className="text-xs font-bold text-white/70">
                        {pkg.size}
                      </span>
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald">
                        {pkg.seeds} seeds · {pkg.peers} peers
                      </span>
                    </div>
                    {pkg.releaseName && (
                      <p
                        className="mt-2 break-all text-[11px] leading-4 text-white/45"
                        title={pkg.releaseName}
                      >
                        {pkg.releaseName}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={pkg.torrentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackTorrentTap('torrent-file', pkg.quality)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-gold px-4 text-[11px] font-black uppercase tracking-wider text-black hover:bg-white"
                      >
                        <Download size={14} /> Torrent file
                      </a>
                      <a
                        href={pkg.magnetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackTorrentTap('torrent-magnet', pkg.quality)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-gold/50 px-4 text-[11px] font-black uppercase tracking-wider text-gold hover:bg-gold hover:text-black"
                      >
                        <Magnet size={14} /> Magnet
                      </a>
                      <button
                        onClick={() => void copyMagnet(pkg.magnetUrl)}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 text-white/60 hover:border-white hover:text-white"
                        aria-label={`Copy ${pkg.quality} magnet link`}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!isLoading && totalPages > 1 && (
              <nav
                className="mt-5 flex flex-wrap items-center justify-center gap-1.5"
                aria-label="Torrent result pages"
              >
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  className="min-h-9 rounded-lg border border-white/15 px-3.5 text-[11px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index + 1}
                    onClick={() => setPage(index + 1)}
                    aria-current={safePage === index + 1 ? 'page' : undefined}
                    className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-[11px] font-black transition-colors ${
                      safePage === index + 1
                        ? 'border-gold bg-gold text-black'
                        : 'border-white/15 text-white/60 hover:border-gold hover:text-gold'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={safePage >= totalPages}
                  className="min-h-9 rounded-lg border border-white/15 px-3.5 text-[11px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next
                </button>
              </nav>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TorrentModal;
