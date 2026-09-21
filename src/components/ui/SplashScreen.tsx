import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Clapperboard } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onComplete, reduceMotion ? 450 : 1800);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.45 }}
      className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-background"
      role="status"
      aria-label="Cine-verse is loading"
    >
      <div className="splash-glow absolute h-[32rem] w-[32rem] rounded-full" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.7, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 180 }}
          className="relative mb-8 grid h-28 w-28 place-items-center rounded-[2rem] border border-gold/35 bg-gold/10 text-gold shadow-[0_0_80px_rgba(232,198,106,0.15)]"
        >
          <span className="absolute inset-2 rounded-[1.55rem] border border-white/10" />
          <Clapperboard size={51} strokeWidth={1.5} aria-hidden="true" />
          <motion.span
            animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-4 border-background bg-ruby"
          />
        </motion.div>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-4xl font-black tracking-[-0.04em] sm:text-5xl"
        >
          CINE<span className="text-gold">-VERSE</span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-[10px] font-bold uppercase tracking-[0.42em] text-white/40"
        >
          Stories beyond the screen
        </motion.p>

        <div className="mt-10 h-px w-48 overflow-hidden bg-white/10">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: reduceMotion ? 0.25 : 1.35, ease: 'easeInOut' }}
            className="h-full w-full bg-gradient-to-r from-ruby via-gold to-ruby"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
