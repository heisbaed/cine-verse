import React, { lazy, Suspense, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from './components/layout/BottomNav';
import Footer from './components/layout/Footer';
import Navbar from './components/layout/Navbar';
import SplashScreen from './components/ui/SplashScreen';

const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const Upcoming = lazy(() => import('./pages/Upcoming'));
const Global = lazy(() => import('./pages/Global'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const MovieDetail = lazy(() => import('./pages/MovieDetail'));
const TVDetail = lazy(() => import('./pages/TVDetail'));
const Download = lazy(() => import('./pages/Download'));
const NotFound = lazy(() => import('./pages/NotFound'));

const RouteLoader: React.FC = () => (
  <div className="flex min-h-[55vh] items-center justify-center px-6">
    <div className="text-center">
      <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-2 border-white/10 border-t-gold" />
      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/35">
        Loading the next scene
      </p>
    </div>
  </div>
);

const App: React.FC = () => {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        )}
      </AnimatePresence>
      <div className="flex min-h-screen flex-col bg-background text-white">
        <div className="ambient-light pointer-events-none fixed inset-0 z-0" />
        <div className="grain pointer-events-none fixed inset-0 z-0" />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar />
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex-1 pb-20 md:pb-0"
            >
              <Suspense fallback={<RouteLoader />}>
                <Routes location={location}>
                  <Route path="/" element={<Home />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/upcoming" element={<Upcoming />} />
                  <Route path="/global" element={<Global />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/movie/:id" element={<MovieDetail />} />
                  <Route path="/tv/:id" element={<TVDetail />} />
                  <Route path="/download" element={<Download />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </motion.main>
          </AnimatePresence>
          <Footer />
          <BottomNav />
        </div>
      </div>
    </>
  );
};

export default App;
