import React from 'react';
import { Film } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
}) => {
  return (
    <div className="text-center py-20 bg-surface border border-white/10 rounded-3xl">
      <div className="text-white/30 mb-4 flex justify-center">
        {icon || <Film size={64} aria-hidden="true" />}
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-white/50 max-w-md mx-auto">{message}</p>
    </div>
  );
};

export default EmptyState;
