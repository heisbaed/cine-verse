import React from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, Download } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer
      className="mt-auto border-t border-white/10 bg-background px-6 pb-28 pt-12 text-center md:py-12"
      role="contentinfo"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Clapperboard size={20} className="text-gold" aria-hidden="true" />
          <span className="text-lg font-bold text-gold">Cine-verse</span>
        </div>
        <p className="text-white/40 text-sm">
          Powered by{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/60 hover:text-gold transition-colors"
          >
            TMDB
          </a>
        </p>
        <p className="text-white/30 text-xs mt-2">
          Developed by <span className="font-semibold text-gold/50">King Bae</span>
        </p>
        <Link
          to="/download"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-bold text-gold transition-all hover:bg-gold hover:text-background focus:outline-none focus:ring-2 focus:ring-gold/50"
        >
          <Download size={16} aria-hidden="true" />
          Get Android App
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
