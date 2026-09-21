import React from 'react';
import { motion } from 'framer-motion';
import { getImageUrl } from '@/api/tmdb';
import { User } from 'lucide-react';
import type { CrewMember } from '@/types/tmdb';

interface CrewSectionProps {
  crew: CrewMember[];
}

const CrewSection: React.FC<CrewSectionProps> = ({ crew }) => {
  const keyCrew = crew.filter(
    (c) =>
      c.job === 'Director' ||
      c.job === 'Writer' ||
      c.job === 'Screenplay' ||
      c.job === 'Producer' ||
      c.job === 'Original Music Composer',
  );

  if (keyCrew.length === 0) {
    return (
      <div className="text-white/50 text-center py-8">
        No crew information available.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <h2 className="text-3xl font-black mb-6">Crew</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {keyCrew.slice(0, 10).map((person) => (
          <div
            key={`${person.id}-${person.job}`}
            className="bg-surface p-4 rounded-2xl border border-white/10 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden border-2 border-white/10 bg-background">
              {person.profile_path ? (
                <img
                  src={getImageUrl(person.profile_path, 'w185')}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  <User size={24} aria-hidden="true" />
                </div>
              )}
            </div>
            <h3 className="font-bold text-sm leading-tight">{person.name}</h3>
            <p className="text-gold text-xs mt-1 font-semibold">{person.job}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default CrewSection;
