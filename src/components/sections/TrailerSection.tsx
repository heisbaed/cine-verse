import React from 'react';
import { motion } from 'framer-motion';
import { Play, ExternalLink } from 'lucide-react';
import type { Video } from '@/types/tmdb';

interface TrailerSectionProps {
  videos: Video[];
  title: string;
}

const TrailerSection: React.FC<TrailerSectionProps> = ({ videos, title }) => {
  const trailer =
    videos.find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
    ) ||
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    videos[0];

  if (!trailer || trailer.site !== 'YouTube') {
    const youtubeSearch = videos.length === 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-surface rounded-2xl border border-white/10 p-6"
      >
        <h2 className="text-3xl font-black mb-4">Trailer</h2>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' official trailer')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-gold/50"
          aria-label={`Search for ${title} trailer on YouTube`}
        >
          <Play size={18} aria-hidden="true" />
          {youtubeSearch ? 'Search Trailer on YouTube' : 'Watch on YouTube'}
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <h2 className="text-3xl font-black mb-6">Trailer</h2>
      <div className="aspect-video rounded-2xl overflow-hidden bg-surface border border-white/10">
        <iframe
          src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0`}
          title={`${trailer.name} - ${title}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </motion.div>
  );
};

export default TrailerSection;
