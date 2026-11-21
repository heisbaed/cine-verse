import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Captions,
  Check,
  Film,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type Hls from 'hls.js';
import { fetchCatalogCaptions, isScraperConfigured } from '@/api/scraper';
import { trackEvent } from '@/lib/siteTracking';
import type { PlaybackSource } from '@/types/playback';

interface VideoPlayerProps {
  mediaKey?: string;
  imdbId?: string | null;
  src?: string;
  sources?: PlaybackSource[];
  poster?: string;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
  kind?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextTitle?: string;
  onNext?: () => void;
  onPrev?: () => void;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`
    : `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  mediaKey,
  imdbId,
  src,
  sources,
  poster,
  title,
  subtitle,
  loading = false,
  error,
  onRetry,
  onClose,
  kind = 'movie',
  season,
  episode,
  hasNext = false,
  hasPrev = false,
  nextTitle,
  onNext,
  onPrev,
}) => {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const resumeAt = useRef(0);
  const failedRef = useRef<Set<string>>(new Set());
  const trackingRef = useRef({ started: false, last: 0, label: 'native' });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextDismissedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [captionError, setCaptionError] = useState('');
  const [localCaption, setLocalCaption] = useState<{ url: string; label: string; key: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [quality, setQuality] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<{ index: number; name: string }[]>([]);
  const [audioIndex, setAudioIndex] = useState(-1);
  const [embeddedSubs, setEmbeddedSubs] = useState<{ index: number; name: string }[]>([]);
  const [nativeSubs, setNativeSubs] = useState<TextTrack[]>([]);
  const [speed, setSpeed] = useState(1);
  const [captionChoice, setCaptionChoice] = useState<{
    label: string; type: 'file' | 'stream' | 'local'; url?: string; streamIndex?: number;
  } | null>(null);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => {
    if (localCaption) URL.revokeObjectURL(localCaption.url);
  }, [localCaption]);

  useEffect(() => () => {
    if (videoClickTimer.current) clearTimeout(videoClickTimer.current);
  }, []);

  const normalizedSources = useMemo<PlaybackSource[]>(() => {
    if (sources && sources.length > 0) return sources;
    if (!src) return [];
    const offline = src.includes('/cineverse-offline/');
    return [{
      id: 'direct',
      name: offline ? 'Offline copy' : 'Direct stream',
      url: src,
      headers: {},
      quality: 'Auto',
      subtitles: [],
      source: offline ? 'Offline' : 'Direct',
      expiresAt: Number.MAX_SAFE_INTEGER,
      contentType: /\.m3u8(?:$|[?#])/i.test(src) ? 'hls' : 'progressive',
      offline,
    }];
  }, [sources, src]);

  const sourceKey = mediaKey ?? `${kind}:${title ?? ''}:${season ?? ''}:${episode ?? ''}`;
  const catalogId = kind === 'tv' && imdbId && season != null && episode != null
    ? `${imdbId}:${season}:${episode}` : kind === 'movie' ? imdbId : null;
  const catalog = useQuery({
    queryKey: ['subtitleCatalog', kind, catalogId],
    queryFn: ({ signal }) => fetchCatalogCaptions(kind, catalogId!, signal),
    enabled: Boolean(captionsOpen && catalogId),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const sourcesRef = useRef(normalizedSources);
  sourcesRef.current = normalizedSources;
  const activeSource = normalizedSources[Math.min(activeIndex, normalizedSources.length - 1)];
  const streamCaptions = [...embeddedSubs, ...nativeSubs.map((track, index) => ({
    index: embeddedSubs.length + index, name: track.label || track.language || `Captions ${index + 1}`,
  }))];
  const captionTracks = useMemo(() => {
    const tracks = [
      ...(activeSource?.subtitles ?? []),
      ...normalizedSources.filter(source => source !== activeSource).flatMap(source => source.subtitles),
      ...(catalog.data ?? []),
      ...(localCaption?.key === sourceKey ? [localCaption] : []),
    ];
    const seen = new Set<string>();
    return tracks.filter(track => {
      if (seen.has(track.url)) return false;
      seen.add(track.url);
      return true;
    });
  }, [activeSource, normalizedSources, catalog.data, localCaption, sourceKey]);

  const sameCaption = (label: string) => label.trim().toLowerCase() === captionChoice?.label.trim().toLowerCase();
  const exactFile = captionTracks.findIndex((track) => track.url === captionChoice?.url);
  const preferredFile = captionChoice?.type === 'local' || exactFile >= 0
    ? exactFile : captionTracks.findIndex((track) => sameCaption(track.label));
  const exactStream = captionChoice?.type === 'stream' && activeSource?.url === captionChoice.url
    ? streamCaptions.find((track) => track.index === captionChoice.streamIndex && sameCaption(track.name)) : undefined;
  const preferredStream = captionChoice?.type === 'local' ? -1
    : (exactStream ?? streamCaptions.find((track) => sameCaption(track.name)))?.index ?? -1;
  const embeddedSubIndex = captionChoice?.type === 'stream' || preferredFile < 0 ? preferredStream : -1;
  const subtitleIndex = embeddedSubIndex < 0 ? preferredFile : -1;

  useEffect(() => {
    const current = normalizedSources[activeIndex];
    if (current && !failedRef.current.has(current.url)) return;
    const next = normalizedSources.findIndex(source => !failedRef.current.has(source.url));
    if (next >= 0) { setActiveIndex(next); setSourceError(null); }
  }, [normalizedSources, activeIndex]);

  const clearNextTimer = useCallback(() => {
    if (nextTimer.current) clearInterval(nextTimer.current);
    nextTimer.current = null;
  }, []);

  const pulse = useCallback((eventName: 'media_progress' | 'media_end') => {
    const tracking = trackingRef.current;
    if (!tracking.started) return;
    const now = Date.now();
    const elapsed = Math.min(Math.max(0, now - tracking.last), 30_000);
    if (eventName === 'media_progress' && elapsed < 9_000) return;
    trackEvent(eventName, {
      label: tracking.label,
      durationMs: elapsed,
      mediaPositionMs: (videoRef.current?.currentTime || 0) * 1000,
    });
    tracking.last = now;
    if (eventName === 'media_end') tracking.started = false;
  }, []);

  useEffect(() => () => pulse('media_end'), [pulse]);

  useEffect(() => {
    pulse('media_end');
    resumeAt.current = 0;
    failedRef.current = new Set();
    setFailedUrls(new Set());
    setActiveIndex(0);
    setSourceError(null);
    setLevels([]); setQuality(-1); setAudioTracks([]); setEmbeddedSubs([]);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setBuffering(true);
    setPlaying(false);
    setCaptionChoice(null);
    setSettingsOpen(false);
    setCaptionsOpen(false);
    setLocalCaption(null);
    nextDismissedRef.current = false;
    setNextCountdown(null);
    clearNextTimer();
  }, [sourceKey, pulse, clearNextTimer]);

  useEffect(() => {
    trackingRef.current.label = activeSource?.offline ? 'offline' : 'native';
  }, [activeSource?.offline]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mounted]);

  const markFailed = useCallback((url: string) => {
    if (failedRef.current.has(url)) return;
    resumeAt.current = videoRef.current?.currentTime || resumeAt.current;
    failedRef.current.add(url);
    setFailedUrls(new Set(failedRef.current));
    const next = sourcesRef.current.findIndex((source) => !failedRef.current.has(source.url));
    if (next >= 0) {
      setActiveIndex(next);
      setSourceError(null);
    } else {
      setSourceError('All available video sources failed to load. Try again in a moment.');
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return;

    let cancelled = false;
    let hls: Hls | null = null;
    let loadedHandler: (() => void) | null = null;
    const isHls = activeSource.contentType === 'hls' || /\.m3u8(?:$|[?#])/i.test(activeSource.url);
    setPlaying(false);
    setBuffered(0);
    setBuffering(true);
    setLevels([]);
    setQuality(-1);
    setAudioTracks([]);
    setAudioIndex(-1);
    setEmbeddedSubs([]);
    setNativeSubs([]);
    setCaptionError('');

    const restorePosition = () => {
      const position = resumeAt.current;
      if (position > 0 && Number.isFinite(video.duration) && position < video.duration) {
        video.currentTime = position;
      }
      resumeAt.current = 0;
    };
    video.addEventListener('loadedmetadata', restorePosition, { once: true });

    const playWhenReady = () => {
      if (!cancelled) void video.play().catch(() => setBuffering(false));
    };

    if (isHls) {
      const useNative = () => {
        if (!video.canPlayType('application/vnd.apple.mpegurl')) {
          markFailed(activeSource.url);
          return;
        }
        video.src = activeSource.url;
        loadedHandler = playWhenReady;
        video.addEventListener('loadedmetadata', loadedHandler, { once: true });
        video.load();
      };
      void import('hls.js').then(({ default: HlsLibrary }) => {
        if (cancelled) return;
        if (!HlsLibrary.isSupported()) {
          useNative();
          return;
        }
        hls = new HlsLibrary({
          enableWorker: true,
          startLevel: -1,
          abrEwmaDefaultEstimate: 600_000,
          capLevelToPlayerSize: true,
          maxBufferLength: 40,
          maxMaxBufferLength: 60,
          backBufferLength: 30,
          xhrSetup: (xhr) => {
            for (const [key, value] of Object.entries(activeSource.headers)) {
              try { xhr.setRequestHeader(key, value); } catch {}
            }
          },
        });
        hlsRef.current = hls;
        hls.on(HlsLibrary.Events.MANIFEST_PARSED, () => {
          setLevels(hls!.levels.map((level, index) => ({ index, height: level.height, bitrate: level.bitrate })));
          playWhenReady();
        });
        hls.on(HlsLibrary.Events.AUDIO_TRACKS_UPDATED, (_event, { audioTracks: tracks }) => {
          setAudioTracks(tracks.map((track, index) => ({ index, name: track.name || track.lang || `Audio ${index + 1}` })));
          setAudioIndex(hls?.audioTrack ?? -1);
        });
        hls.on(HlsLibrary.Events.SUBTITLE_TRACKS_UPDATED, (_event, { subtitleTracks: tracks }) => {
          setEmbeddedSubs(tracks.map((track, index) => ({ index, name: track.name || track.lang || `Captions ${index + 1}` })));
        });
        let recoveredDecode = false;
        hls.on(HlsLibrary.Events.ERROR, (_event, data) => {
          if (!data.fatal || cancelled) return;
          if (data.type === HlsLibrary.ErrorTypes.MEDIA_ERROR && !recoveredDecode) {
            recoveredDecode = true;
            hls?.recoverMediaError();
          } else {
            markFailed(activeSource.url);
          }
        });
        hls.loadSource(activeSource.url);
        hls.attachMedia(video);
      }).catch(() => {
        if (!cancelled) useNative();
      });
    } else {
      video.src = activeSource.url;
      loadedHandler = playWhenReady;
      video.addEventListener('loadedmetadata', loadedHandler, { once: true });
      video.load();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', restorePosition);
      if (loadedHandler) video.removeEventListener('loadedmetadata', loadedHandler);
      if (hls) {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [mounted, sourceKey, activeSource?.url, retryCount, markFailed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (!video.paused && Date.now() - trackingRef.current.last >= 10_000) pulse('media_progress');
    };
    const onDurationChange = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onPlay = () => {
      if (!trackingRef.current.started) {
        trackingRef.current.started = true;
        trackingRef.current.last = Date.now();
        trackEvent('media_start', { label: trackingRef.current.label });
      }
      setPlaying(true);
      setBuffering(video.readyState < 3);
    };
    const onPause = () => {
      pulse('media_progress');
      setPlaying(false);
    };
    const onEnded = () => {
      pulse('media_end');
      setPlaying(false);
    };
    const onWaiting = () => {
      if (video.paused) return;
      setBuffering(true);
    };
    const onCanPlay = () => setBuffering(false);
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onError = () => {
      if (activeSource && video.error && video.error.code !== MediaError.MEDIA_ERR_ABORTED) markFailed(activeSource.url);
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onCanPlay);
    video.addEventListener('progress', onProgress);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onCanPlay);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('error', onError);
    };
  }, [mounted, sourceKey, activeSource?.url, retryCount, markFailed, pulse]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, activeSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      const external = new Set(Array.from(video.querySelectorAll('track'), (element) => element.track));
      setNativeSubs(Array.from(video.textTracks).filter((track) =>
        (track.kind === 'captions' || track.kind === 'subtitles') && !external.has(track) &&
        !embeddedSubs.some(rendition => rendition.name === track.label)));
    };
    update();
    video.addEventListener('loadedmetadata', update);
    video.textTracks.addEventListener('addtrack', update);
    video.textTracks.addEventListener('removetrack', update);
    return () => {
      video.removeEventListener('loadedmetadata', update);
      video.textTracks.removeEventListener('addtrack', update);
      video.textTracks.removeEventListener('removetrack', update);
    };
  }, [mounted, activeSource?.url, retryCount, embeddedSubs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const hls = hlsRef.current;
    if (hls) {
      const rendition = embeddedSubIndex < embeddedSubs.length ? embeddedSubIndex : -1;
      if (hls.subtitleDisplay !== (rendition >= 0)) hls.subtitleDisplay = rendition >= 0;
      if (hls.subtitleTrack !== rendition) hls.subtitleTrack = rendition;
    }
    // hls.js can disable every DOM text track when switching renditions.
    // Apply browser and file selections after the HLS switch.
    nativeSubs.forEach((track, index) => {
      track.mode = embeddedSubs.length + index === embeddedSubIndex ? 'showing' : 'disabled';
    });
    Array.from(video.querySelectorAll('track')).forEach((element, index) => {
      element.track.mode = index === subtitleIndex ? 'showing' : 'disabled';
    });
  }, [mounted, subtitleIndex, embeddedSubIndex, embeddedSubs, nativeSubs, activeSource?.url, captionTracks, sourceKey]);

  const loadCaptionFile = async (file: File) => {
    try {
      if (file.size > 2_000_000) throw new Error('Choose a subtitle file under 2 MB.');
      const content = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
      const vtt = /^WEBVTT(?:\s|$)/.test(content) ? content
        : `WEBVTT\n\n${content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
      if (!vtt.includes('-->')) throw new Error('Choose a valid .srt or .vtt file.');
      const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      setLocalCaption({ url, label: file.name, key: sourceKey });
      setCaptionChoice({ label: file.name, type: 'local', url });
      setCaptionError('');
    } catch (error) {
      setCaptionError(error instanceof Error ? error.message : 'Could not open the subtitle file.');
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const armControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing && !settingsOpen && !captionsOpen) hideTimer.current = setTimeout(() => setShowControls(false), 3_500);
  }, [playing, settingsOpen, captionsOpen]);

  useEffect(() => {
    armControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [armControls]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    armControls();
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }, [armControls]);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration);
    armControls();
  }, [armControls]);

  const seekRatio = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(ratio, 0), 1) * video.duration;
    armControls();
  }, [armControls]);

  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekRatio((event.clientX - rect.left) / rect.width);
  }, [seekRatio]);

  const handleVideoClick = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    if (videoClickTimer.current) clearTimeout(videoClickTimer.current);
    videoClickTimer.current = setTimeout(() => {
      videoClickTimer.current = null;
      if (ratio < 0.28) seekBy(-10);
      else if (ratio > 0.72) seekBy(10);
      else togglePlay();
    }, 220);
  }, [seekBy, togglePlay]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    armControls();
  }, [armControls]);

  const toggleFullscreen = useCallback(async () => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await element.requestFullscreen();
  }, []);

  const handleVideoDoubleClick = useCallback(() => {
    if (videoClickTimer.current) clearTimeout(videoClickTimer.current);
    videoClickTimer.current = null;
    void toggleFullscreen();
  }, [toggleFullscreen]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  }, []);

  const startNext = useCallback(() => {
    clearNextTimer();
    setNextCountdown(null);
    onNext?.();
  }, [clearNextTimer, onNext]);

  useEffect(() => {
    if (!hasNext || !onNext || nextDismissedRef.current || duration <= 0) return;
    const remaining = duration - currentTime;
    if (remaining > 0 && remaining <= 25 && !nextTimer.current) {
      setNextCountdown(8);
      nextTimer.current = setInterval(() => {
        setNextCountdown((value) => {
          if (value === null) return null;
          if (value <= 1) {
            clearNextTimer();
            startNext();
            return null;
          }
          return value - 1;
        });
      }, 1000);
    }
  }, [currentTime, duration, hasNext, onNext, clearNextTimer, startNext]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (captionsOpen) setCaptionsOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else onClose?.();
        return;
      }
      if (event.target instanceof HTMLElement &&
        event.target.closest('button, input, select, textarea, a, [contenteditable]')) return;
      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowRight') seekBy(10);
      else if (event.key === 'ArrowLeft') seekBy(-10);
      else if (event.key.toLowerCase() === 'm') toggleMute();
      else if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      armControls();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [armControls, captionsOpen, onClose, seekBy, settingsOpen, toggleFullscreen, toggleMute, togglePlay]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;
  const shownError = (!activeSource ? error : null) || sourceError;
  const unavailable = !loading && !shownError && normalizedSources.length === 0;
  const showStatus = Boolean((loading && !activeSource) || unavailable || shownError);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="media-dialog media-on-dark fixed inset-0 z-[200] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Video player'}
    >
      {showStatus && (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          {loading ? <LoaderCircle size={52} className="animate-spin text-gold" aria-hidden="true" /> : <Film size={52} className="text-ruby/60" aria-hidden="true" />}
          <p className="max-w-md text-sm text-white/70">
            {loading ? 'Finding a direct stream...' : shownError || (!isScraperConfigured() ? 'Direct stream service is not configured yet.' : 'No direct stream was returned for this title.')}
          </p>
          <div className="flex gap-3">
            {onRetry && !loading && <button type="button" onClick={() => { failedRef.current.clear(); setFailedUrls(new Set()); setSourceError(null); setActiveIndex(0); setRetryCount((count) => count + 1); onRetry(); }} className="rounded-full border border-gold/40 px-5 py-2 text-xs font-black uppercase tracking-[0.12em] text-gold hover:bg-gold/10">Retry</button>}
            {onClose && <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-5 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70 hover:border-white/50 hover:text-white">Close</button>}
          </div>
        </div>
      )}
        <div
          ref={containerRef}
          hidden={showStatus}
          tabIndex={0}
          className="relative h-full w-full overflow-hidden bg-black outline-none"
          onMouseMove={armControls}
          onTouchStart={armControls}
          onDoubleClick={handleVideoDoubleClick}
        >
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            poster={poster}
            playsInline
            preload="metadata"
            crossOrigin={activeSource?.offline ? undefined : 'anonymous'}
            onClick={handleVideoClick}
            onLoadedData={() => setBuffering(false)}
          >
            {captionTracks.map((track, index) => (
              <track key={track.url} kind="subtitles" src={track.url} srcLang="und" label={`${track.label} (file)`}
                onError={() => { if (subtitleIndex === index) setCaptionError('This subtitle track could not load.'); }}
                onLoad={() => { if (subtitleIndex === index) setCaptionError(''); }} />
            ))}
          </video>

          {buffering && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <LoaderCircle size={54} className="animate-spin text-gold/90" aria-hidden="true" />
            </div>
          )}

          {!playing && !buffering && (
            <button type="button" onClick={togglePlay} className="absolute inset-0 grid place-items-center" aria-label="Play">
              <span className="grid h-20 w-20 place-items-center rounded-full border border-gold/60 bg-black/55 text-gold backdrop-blur-sm transition-transform hover:scale-110">
                <Play size={34} fill="currentColor" aria-hidden="true" />
              </span>
            </button>
          )}

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/80 via-transparent to-black/90"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start gap-3 px-4 py-4 sm:px-7 sm:py-6">
                  {onClose && (
                    <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/40 text-white/80 hover:text-gold" aria-label="Close player">
                      <ArrowLeft size={23} aria-hidden="true" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black sm:text-xl">{title || 'Now playing'}</h2>
                    <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-[0.16em] text-gold/80">{subtitle || (kind === 'tv' && season && episode ? `S${season} · E${episode}` : 'Cineverse')}</p>
                  </div>
                  <div className="ml-auto hidden rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/55 sm:block">
                    {activeSource?.source} · {activeSource?.quality}
                  </div>
                </div>

                <div className="px-4 pb-4 sm:px-7 sm:pb-7">
                  {kind === 'tv' && currentTime > 0 && currentTime < 90 && (
                    <div className="mb-3 flex justify-end">
                      <button type="button" onClick={() => seekBy(85)} className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-black/60 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-gold hover:bg-gold/15">
                        <SkipForward size={15} aria-hidden="true" /> Skip intro
                      </button>
                    </div>
                  )}

                  {nextCountdown !== null && (
                    <div className="mb-4 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gold/30 bg-black/75 p-3 backdrop-blur-sm">
                      <p className="text-xs font-bold text-white/65">Next episode{nextTitle ? `: ${nextTitle}` : ''}</p>
                      <button type="button" onClick={startNext} className="rounded-lg bg-gold px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-black">Play now · {nextCountdown}s</button>
                      <button type="button" onClick={() => { clearNextTimer(); nextDismissedRef.current = true; setNextCountdown(null); }} className="rounded-lg border border-white/20 px-3 py-2 text-[11px] font-black text-white/60 hover:text-white">Cancel</button>
                    </div>
                  )}

                  <div className="relative mb-3 h-1.5 cursor-pointer rounded-full bg-white/20" onClick={handleSeek} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${Math.min(bufferedProgress, 100)}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gold" style={{ width: `${Math.min(progress, 100)}%` }} />
                    <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_12px_rgba(232,198,106,0.7)]" style={{ left: `${Math.min(progress, 100)}%` }} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button type="button" onClick={togglePlay} className="grid h-10 w-10 place-items-center rounded-full text-white hover:text-gold" aria-label={playing ? 'Pause' : 'Play'}>
                      {playing ? <Pause size={23} fill="currentColor" aria-hidden="true" /> : <Play size={23} fill="currentColor" aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={() => seekBy(-10)} className="grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold" aria-label="Back 10 seconds"><RotateCcw size={20} aria-hidden="true" /></button>
                    <button type="button" onClick={() => seekBy(10)} className="grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold" aria-label="Forward 10 seconds"><RotateCw size={20} aria-hidden="true" /></button>
                    <button type="button" onClick={toggleMute} className="grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold" aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}</button>
                    <span className="font-mono text-xs text-white/60 sm:text-sm">{formatTime(currentTime)} / {formatTime(duration)}</span>

                    <div className="ml-auto flex items-center gap-2">
                      {kind === 'tv' && hasPrev && onPrev && (
                        <button type="button" onClick={onPrev} className="hidden h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold sm:grid" aria-label="Previous episode"><ArrowLeft size={20} aria-hidden="true" /></button>
                      )}
                      {kind === 'tv' && hasNext && onNext && (
                        <button type="button" onClick={startNext} className="hidden h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold sm:grid" aria-label="Next episode"><SkipForward size={20} aria-hidden="true" /></button>
                      )}
                      <button type="button" aria-label="Subtitles" aria-expanded={captionsOpen}
                        onClick={() => { setSettingsOpen(false); setCaptionsOpen((open) => !open); }}
                        className={`grid h-10 w-10 place-items-center rounded-full ${subtitleIndex >= 0 || embeddedSubIndex >= 0 ? 'text-gold' : 'text-white/70 hover:text-gold'}`}>
                        <Captions size={21} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => { setCaptionsOpen(false); setSettingsOpen((open) => !open); }} className="grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold" aria-label="Playback settings"><Settings size={20} aria-hidden="true" /></button>
                      <button type="button" onClick={() => void togglePip()} className="hidden h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold sm:grid" aria-label="Picture in picture"><PictureInPicture2 size={20} aria-hidden="true" /></button>
                      <button type="button" onClick={() => void toggleFullscreen()} className="grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-gold" aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{fullscreen ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}</button>
                    </div>
                  </div>
                </div>

                {captionsOpen && (
                  <div className="absolute bottom-20 right-3 max-h-[70%] w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#141217] p-4 shadow-xl sm:right-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold">Subtitles</h3>
                      <button type="button" aria-label="Close subtitles" onClick={() => setCaptionsOpen(false)}><X size={19} /></button>
                    </div>
                    <select aria-label="Subtitle track" className="w-full rounded-lg border border-white/15 bg-black p-2 text-sm"
                      value={embeddedSubIndex >= 0 ? `stream:${embeddedSubIndex}` : subtitleIndex >= 0 ? `file:${subtitleIndex}` : 'off'}
                      onChange={(event) => {
                        const [kind, index] = event.target.value.split(':');
                        const stream = streamCaptions.find((track) => track.index === Number(index));
                        const file = captionTracks[Number(index)];
                        if (kind === 'stream' && stream) setCaptionChoice({ label: stream.name, type: 'stream', url: activeSource?.url, streamIndex: stream.index });
                        else if (kind === 'file' && file) setCaptionChoice({ label: file.label, type: file.url === localCaption?.url ? 'local' : 'file', url: file.url });
                        else setCaptionChoice(null);
                        setCaptionError('');
                      }}>
                      <option value="off">Off</option>
                      {streamCaptions.map((track) => <option key={`stream:${track.index}`} value={`stream:${track.index}`}>{track.name} (stream)</option>)}
                      {captionTracks.map((track, index) => <option key={track.url} value={`file:${index}`}>{track.label}</option>)}
                    </select>
                    {catalog.isFetching && <p role="status" className="mt-2 text-xs text-white/60">Finding subtitles…</p>}
                    {catalog.isError && <button type="button" onClick={() => void catalog.refetch()} className="mt-2 text-xs text-gold">Retry subtitle lookup</button>}
                    {!catalog.isFetching && !catalog.isError && !streamCaptions.length && !captionTracks.length && <p className="mt-2 text-xs text-white/60">No matching subtitles found.</p>}
                    {captionChoice && subtitleIndex < 0 && embeddedSubIndex < 0 && (streamCaptions.length > 0 || captionTracks.length > 0) &&
                      <p className="mt-2 text-xs text-white/60">The selected track is unavailable on this source.</p>}
                    {captionError && <p role="status" className="mt-2 text-xs text-ruby">{captionError}</p>}
                    <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-gold focus-within:outline-2">
                      Add .srt or .vtt
                      <input className="sr-only" type="file" accept=".srt,.vtt" onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void loadCaptionFile(file);
                        event.currentTarget.value = '';
                      }} />
                    </label>
                  </div>
                )}

                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 24 }}
                      onClick={(event) => event.stopPropagation()}
                      className="absolute bottom-0 right-0 flex max-h-[80%] w-full max-w-sm flex-col overflow-y-auto border-l border-t border-white/15 bg-[#141217] p-5 shadow-xl sm:bottom-20 sm:right-6 sm:rounded-2xl sm:border"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-gold">Playback settings</h3>
                        <button type="button" onClick={() => setSettingsOpen(false)} className="text-white/50 hover:text-white" aria-label="Close settings"><X size={19} aria-hidden="true" /></button>
                      </div>

                      <p className="mb-2 text-xs font-semibold text-white/75">Source</p>
                      <div className="mb-5 flex flex-col gap-1">
                        {normalizedSources.map((source, index) => (
                          <button key={`${source.id}-${source.url}`} type="button" onClick={() => {
                            resumeAt.current = videoRef.current?.currentTime || resumeAt.current;
                            if (failedRef.current.delete(source.url)) setFailedUrls(new Set(failedRef.current));
                            if (index === activeIndex) setRetryCount(count => count + 1);
                            setActiveIndex(index);
                            setSourceError(null);
                          }} className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold ${index === activeIndex ? 'bg-gold/15 text-gold' : 'text-white/65 hover:bg-white/5'}`}>
                            <span className="truncate">Cineverse {index + 1} · {source.quality}{failedUrls.has(source.url) ? ' · Retry' : ''}</span>
                            {index === activeIndex && <Check size={15} aria-hidden="true" />}
                          </button>
                        ))}
                      </div>

                      {levels.length > 0 && <>
                        <p className="mb-2 text-xs font-semibold text-white/75">Quality</p>
                        <div className="mb-5 flex flex-wrap gap-2">
                          {[{ index: -1, height: 0, bitrate: 0 }, ...levels].map((level) => (
                            <button key={level.index} type="button" aria-pressed={quality === level.index}
                              className="rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:border-gold aria-pressed:border-gold aria-pressed:bg-gold aria-pressed:text-black"
                              onClick={() => { setQuality(level.index); if (hlsRef.current) hlsRef.current.nextLevel = level.index; }}>
                              {level.index === -1 ? 'Auto' : level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`}
                            </button>
                          ))}
                        </div>
                      </>}
                      {audioTracks.length > 1 && <label className="mb-5 text-xs text-white/60">Audio<select className="mt-2 w-full rounded-lg bg-black p-3" value={audioIndex} onChange={(e) => { const index = Number(e.target.value); setAudioIndex(index); if (hlsRef.current) hlsRef.current.audioTrack = index; }}>{audioTracks.map((track) => <option key={track.index} value={track.index}>{track.name}</option>)}</select></label>}
                      <p className="mb-2 text-xs font-semibold text-white/75">Speed</p>
                      <div className="mb-5 flex flex-wrap gap-2">
                        {SPEEDS.map((value) => (
                          <button key={value} type="button" onClick={() => setSpeed(value)} className={`rounded-lg border px-3 py-1.5 text-[11px] font-black ${speed === value ? 'border-gold bg-gold text-black' : 'border-white/15 text-white/60 hover:border-gold/50 hover:text-gold'}`}>{value}x</button>
                        ))}
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    </motion.div>,
    document.body,
  );
};

export default VideoPlayer;
