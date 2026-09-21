import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Film,
} from 'lucide-react';
import type { EmbedSource } from '@/utils/embedSources';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  embed?: boolean;
  sources?: EmbedSource[];
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  embed = false,
  sources,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hlsSupported, setHlsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHls = src?.includes('.m3u8');
  const embedSources =
    sources && sources.length > 0 ? sources : [{ name: 'Primary', url: src }];
  const sourceKey = embedSources.map((source) => source.url).join('|');
  const activeSource = embedSources[
    Math.min(activeSourceIndex, embedSources.length - 1)
  ];

  useEffect(() => {
    setActiveSourceIndex(0);
    setSourceLoaded(false);
    setEmbedError(null);
  }, [sourceKey]);

  const tryNextSource = useCallback(() => {
    if (activeSourceIndex < embedSources.length - 1) {
      setActiveSourceIndex((index) => index + 1);
      setSourceLoaded(false);
      return;
    }

    setEmbedError('All available video sources failed to load.');
  }, [activeSourceIndex, embedSources.length]);

  useEffect(() => {
    if (!embed || sourceLoaded || embedError || embedSources.length < 2) return;

    const timeout = window.setTimeout(tryNextSource, 12_000);
    return () => window.clearTimeout(timeout);
  }, [
    activeSourceIndex,
    embed,
    embedError,
    embedSources.length,
    sourceLoaded,
    tryNextSource,
  ]);

  useEffect(() => {
    if (!videoRef.current || !src) return;

    const video = videoRef.current;

    if (isHls) {
      let hls: any = null;
      import('hls.js').then((HlsModule) => {
        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) {
              setError('Failed to load video stream.');
            }
          });
          setHlsSupported(true);
        } else {
          setHlsSupported(false);
          setError('HLS is not supported in this browser.');
        }
      });
      return () => {
        if (hls) hls.destroy();
      };
    }
  }, [src, isHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHls) return;

    const handleLoaded = () => {
      video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [isHls]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [playing]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (fullscreen) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, [fullscreen]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    video.currentTime = ratio * duration;
  }, [duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setPlaying(false);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onError = () => {
      setError('Failed to load video.');
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('progress', onProgress);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  if (embed && src) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-black">{title || 'Now Playing'}</h2>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">
            Source: {activeSource.name}
          </span>
        </div>
        <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/10">
          {embedError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Film size={42} className="text-ruby/60" aria-hidden="true" />
              <p className="text-white/65">{embedError}</p>
              <button
                type="button"
                onClick={() => {
                  setActiveSourceIndex(0);
                  setSourceLoaded(false);
                  setEmbedError(null);
                }}
                className="rounded-full border border-gold/40 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-gold hover:bg-gold/10"
              >
                Retry sources
              </button>
            </div>
          ) : (
            <iframe
              key={activeSource.url}
              src={activeSource.url}
              title={`${title || 'Movie'} player via ${activeSource.name}`}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              onLoad={() => setSourceLoaded(true)}
              onError={tryNextSource}
            />
          )}
        </div>
        {embedSources.length > 1 && !embedError && (
          <button
            type="button"
            onClick={tryNextSource}
            className="mt-3 text-sm font-bold text-gold hover:underline"
          >
            Player not working? Try the next source
          </button>
        )}
      </motion.div>
    );
  }

  if (!src) {
    return (
      <div className="aspect-video rounded-2xl bg-surface border border-white/10 flex items-center justify-center">
        <div className="text-center">
          <Film size={48} className="mx-auto mb-3 text-white/20" aria-hidden="true" />
          <p className="text-white/40">No video source available</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video rounded-2xl bg-surface border border-white/10 flex items-center justify-center">
        <div className="text-center px-6">
          <Film size={48} className="mx-auto mb-3 text-ruby/40" aria-hidden="true" />
          <p className="text-white/60 mb-2">{error}</p>
          <p className="text-white/30 text-sm">
            {isHls && !hlsSupported
              ? 'Try a browser that supports HLS streaming.'
              : 'The video source may be unavailable.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h2 className="text-3xl font-black mb-6">{title || 'Now Playing'}</h2>
      <div
        ref={containerRef}
        className="media-on-dark group relative aspect-video cursor-pointer overflow-hidden rounded-2xl bg-black"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => playing && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={isHls ? undefined : src}
          className="w-full h-full object-contain"
          poster={poster}
          playsInline
          preload="metadata"
          onClick={togglePlay}
        />

        {/* Buffering indicator */}
        {!playing && !error && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-20 h-20 rounded-full bg-gold/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
              <Play size={36} fill="#09090B" className="text-background ml-1" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Controls overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end"
            >
              {/* Progress bar */}
              <div
                className="relative h-1.5 mx-4 mb-3 bg-white/20 rounded-full cursor-pointer group/progress"
                onClick={handleSeek}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                  style={{ width: `${bufferedProgress}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gold group-hover/progress:bg-gold transition-colors"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gold scale-0 group-hover/progress:scale-100 transition-transform"
                  style={{ left: `${progress}%`, marginLeft: '-7px' }}
                />
              </div>

              {/* Bottom controls */}
              <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="text-white hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded-lg p-1"
                    aria-label={playing ? 'Pause' : 'Play'}
                  >
                    {playing ? (
                      <Pause size={22} fill="currentColor" aria-hidden="true" />
                    ) : (
                      <Play size={22} fill="currentColor" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    onClick={toggleMute}
                    className="text-white/70 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded-lg p-1"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <VolumeX size={20} aria-hidden="true" />
                    ) : (
                      <Volume2 size={20} aria-hidden="true" />
                    )}
                  </button>

                  <span className="text-white/60 text-sm font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="text-white/70 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded-lg p-1"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? (
                    <Minimize size={20} aria-hidden="true" />
                  ) : (
                    <Maximize size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default VideoPlayer;
