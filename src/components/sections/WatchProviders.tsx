import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Monitor } from 'lucide-react';
import type { WatchProvider } from '@/types/tmdb';

interface WatchProvidersProps {
  providers: {
    flatrate?: WatchProvider[];
    rent?: WatchProvider[];
    buy?: WatchProvider[];
  } | null;
  country?: string;
}

const ProviderList: React.FC<{
  title: string;
  providers: WatchProvider[];
}> = ({ title, providers }) => (
  <div>
    <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
      {title}
    </h4>
    <div className="flex flex-wrap gap-3">
      {providers.map((provider) => (
        <div
          key={provider.provider_id}
          className="flex items-center gap-2 bg-background px-3 py-2 rounded-xl border border-white/10"
          title={provider.provider_name}
        >
          {provider.logo_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
              alt={provider.provider_name}
              className="w-8 h-8 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <Monitor size={20} className="text-white/40" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold">{provider.provider_name}</span>
        </div>
      ))}
    </div>
  </div>
);

const WatchProviders: React.FC<WatchProvidersProps> = ({
  providers,
  country = 'US',
}) => {
  if (!providers) return null;

  const hasAny =
    providers.flatrate?.length ||
    providers.rent?.length ||
    providers.buy?.length;

  if (!hasAny) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-surface rounded-2xl border border-white/10 p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Monitor size={22} className="text-gold" aria-hidden="true" />
        <h2 className="text-2xl font-black">
          Where to Watch
        </h2>
        <span className="text-xs text-white/40 ml-auto">
          {country}
        </span>
      </div>

      <div className="space-y-5">
        {providers.flatrate && providers.flatrate.length > 0 && (
          <ProviderList title="Stream" providers={providers.flatrate} />
        )}
        {providers.rent && providers.rent.length > 0 && (
          <ProviderList title="Rent" providers={providers.rent} />
        )}
        {providers.buy && providers.buy.length > 0 && (
          <ProviderList title="Buy" providers={providers.buy} />
        )}
      </div>

      <p className="text-xs text-white/30 mt-4 flex items-center gap-1">
        Availability based on your region.
        <ExternalLink size={10} aria-hidden="true" />
      </p>
    </motion.div>
  );
};

export default WatchProviders;
