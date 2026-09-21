import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="w-48 sm:w-52 rounded-2xl overflow-hidden bg-surface border border-white/10 flex-shrink-0 animate-pulse">
      <div className="aspect-[2/3] bg-white/5" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-white/10 rounded-lg w-3/4" />
        <div className="h-4 bg-white/10 rounded-lg w-1/2" />
      </div>
    </div>
  );
};

export default SkeletonCard;
