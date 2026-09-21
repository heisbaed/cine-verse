import React from 'react';
import { AlertTriangle, Clapperboard } from 'lucide-react';

const SetupScreen: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold/20 text-gold mb-4">
          <Clapperboard size={40} aria-hidden="true" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
          Welcome to <span className="text-gold">Cine-verse</span>
        </h1>
        <p className="text-xl text-white/70 leading-relaxed mb-8">
          To unlock real-time movie data, you&apos;ll need a TMDB API key.
          Don&apos;t worry, it&apos;s free and easy to get!
        </p>
        <div className="bg-surface border border-gold/30 rounded-2xl p-6 text-left space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-gold" aria-hidden="true" />
            <h3 className="font-bold text-xl text-gold">
              API Key Required
            </h3>
          </div>
          <ol className="list-decimal list-inside space-y-3 text-white/80">
            <li>
              Go to{' '}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline hover:text-gold/80 transition-colors"
              >
                TMDB API settings
              </a>{' '}
              and create an account if you don&apos;t have one.
            </li>
            <li>
              Create a new API key (select &ldquo;Developer&rdquo; and fill out
              the form).
            </li>
            <li>
              In your project root, create a file named{' '}
              <code className="bg-background px-2 py-1 rounded text-gold font-mono text-sm">
                .env
              </code>
              .
            </li>
            <li>
              Add this line to the file:
              <pre className="mt-2 bg-background p-3 rounded-xl text-gold font-mono text-sm overflow-x-auto">
                VITE_TMDB_API_KEY=your_api_key_here
              </pre>
            </li>
            <li>Restart your dev server, and you&apos;re ready to go!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;
