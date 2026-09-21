import React from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, ExternalLink } from 'lucide-react';
import { getImageUrl } from '@/api/tmdb';
import { User } from 'lucide-react';
import type { Review } from '@/types/tmdb';

interface ReviewsSectionProps {
  reviews: Review[];
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({ reviews }) => {
  if (reviews.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <h2 className="text-3xl font-black mb-6">Reviews</h2>
        <div className="bg-surface rounded-2xl border border-white/10 p-8 text-center">
          <MessageSquare size={40} className="mx-auto mb-3 text-white/20" aria-hidden="true" />
          <p className="text-white/50">No reviews yet.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      <h2 className="text-3xl font-black mb-6">
        Reviews ({reviews.length})
      </h2>
      <div className="space-y-4">
        {reviews.slice(0, 5).map((review) => (
          <div
            key={review.id}
            className="bg-surface rounded-2xl border border-white/10 p-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-background border border-white/10 flex-shrink-0">
                {review.author_details?.avatar_path ? (
                  <img
                    src={getImageUrl(review.author_details.avatar_path, 'w185')}
                    alt={review.author}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30">
                    <User size={18} aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-sm">
                    {review.author_details?.name || review.author}
                  </h3>
                  {review.author_details?.rating && (
                    <span className="flex items-center gap-1 text-gold text-xs font-bold">
                      <Star size={12} fill="currentColor" aria-hidden="true" />
                      {review.author_details.rating}/10
                    </span>
                  )}
                </div>
              </div>
              <a
                href={review.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 hover:text-gold transition-colors flex-shrink-0"
                aria-label="Read full review"
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
            <p className="text-white/70 text-sm leading-relaxed line-clamp-3">
              {review.content}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ReviewsSection;
