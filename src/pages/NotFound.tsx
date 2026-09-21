import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Film, Home } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

const NotFound: React.FC = () => {
  useSEO({ title: 'Page Not Found' });

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg"
      >
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/5 border border-white/10 mb-8">
          <Film size={48} className="text-white/30" aria-hidden="true" />
        </div>
        <h1 className="text-8xl font-black text-gold mb-4">404</h1>
        <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
        <p className="text-white/50 text-lg mb-8">
          This scene doesn&apos;t exist in our database. Let&apos;s get you
          back to the main feature.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-gold to-ruby text-background font-bold text-lg hover:scale-105 transition-transform shadow-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
          aria-label="Go to home page"
        >
          <Home size={20} aria-hidden="true" />
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
