import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Video } from '@/types/tmdb';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: Video[];
  title: string;
  /** Videos are still being fetched; show a spinner until data lands. */
  loading?: boolean;
}

const TrailerModal: React.FC<TrailerModalProps> = ({
  isOpen,
  onClose,
  videos,
  title,
  loading = false,
}) => {
  const trailer =
    videos.find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
    ) ||
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    videos.find((v) => v.site === 'YouTube') ||
    videos[0];

  const hasYouTube = Boolean(trailer && trailer.site === 'YouTube');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="media-on-dark fixed inset-0 z-[100] flex items-center justify-center bg-black/90 px-4 text-white backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} trailer`}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
              aria-label="Close trailer"
            >
              <X size={24} />
            </button>
            {hasYouTube ? (
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
                title={`${trailer.name} - ${title}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : loading ? (
              <div className="grid h-full w-full place-items-center bg-surface">
                <div className="flex flex-col items-center gap-3 text-white/70">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
                  <p className="text-sm font-medium">Loading trailer…</p>
                </div>
              </div>
            ) : (
              <div className="grid h-full w-full place-items-center bg-surface">
                <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
                  <p className="text-lg font-bold">No trailer yet</p>
                  <p className="text-sm text-white/60">
                    This title has no YouTube trailer available right now.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TrailerModal;
