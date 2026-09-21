import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong while fetching data.',
  onRetry,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20 bg-surface border border-white/10 rounded-3xl px-6"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ruby/20 text-ruby mb-4">
        <AlertTriangle size={32} aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Error</h2>
      <p className="text-white/50 max-w-md mx-auto mb-6">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-background font-bold hover:bg-gold/90 transition-all focus:outline-none focus:ring-2 focus:ring-gold/50"
          aria-label="Retry loading"
        >
          <RefreshCw size={18} aria-hidden="true" />
          Try Again
        </button>
      )}
    </motion.div>
  );
};

export default ErrorState;
