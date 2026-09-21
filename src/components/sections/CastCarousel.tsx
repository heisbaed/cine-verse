import React from 'react';
import { motion } from 'framer-motion';
import { getImageUrl } from '@/api/tmdb';
import { User } from 'lucide-react';
import type { CastMember } from '@/types/tmdb';

interface CastCarouselProps {
  cast: CastMember[];
}

const CastCarousel: React.FC<CastCarouselProps> = ({ cast }) => {
  if (cast.length === 0) {
    return (
      <div className="text-white/50 text-center py-8">
        No cast information available.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h2 className="text-3xl font-black mb-6">Cast</h2>
      <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x">
        {cast.map((person) => (
          <div
            key={person.id}
            className="snap-start flex-shrink-0 w-36 text-center"
          >
            <div className="w-28 h-28 mx-auto mb-3 rounded-full overflow-hidden border-2 border-white/10 bg-surface">
              {person.profile_path ? (
                <img
                  src={getImageUrl(person.profile_path, 'w185')}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  <User size={32} aria-hidden="true" />
                </div>
              )}
            </div>
            <h3 className="font-bold text-sm leading-tight">{person.name}</h3>
            <p className="text-white/50 text-xs mt-1 leading-tight">
              {person.character}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default CastCarousel;
