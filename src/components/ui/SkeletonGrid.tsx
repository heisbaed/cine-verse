import React from 'react';
import SkeletonCard from './SkeletonCard';

interface SkeletonGridProps {
  count?: number;
}

const SkeletonGrid: React.FC<SkeletonGridProps> = ({ count = 10 }) => {
  return (
    <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

export default SkeletonGrid;
