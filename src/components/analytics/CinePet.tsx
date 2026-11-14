import React, { useEffect } from 'react';
import CineMate from '../cinemate/CineMate';
import CineMateChat from '../cinemate/CineMateChat';
import { useCineMate } from '@/hooks/useCineMate';
import { cineMateCore } from '@/lib/cineMateCore';

interface CinePetProps {
  data: {
    current: Array<{ name: string; timestamp: number; path: string; surface: string }>;
    views: number;
    sessions: number;
    activeNow: number;
    opens: number;
    searches: number;
    downloadClicks: number;
    firstLaunches: number;
    averageSessionMs: number;
    hasDuration: boolean;
    titles?: Array<{ kind: 'movie' | 'tv'; id: number; visits: number; opens: number }>;
    surfaces?: Array<{ name: string; sessions: number }>;
  };
  ready: boolean;
  days: number;
  surfaceLabel: string;
}

const WELCOME = [
  'Beep! I am Cine, your dashboard bot. Drag me around, double-tap me to dance — or ask me to summarize anything you see.',
  'Hello! I am Cine. I watch the analytics stream and chat with you about it. Try "summarize" or "top titles".',
];

export default function CinePet(props: CinePetProps) {
  const {
    data,
    ready,
    days,
    surfaceLabel,
  } = props;
  const {
    messages,
    open,
    accent,
    mood,
    eyelids,
    mouth,
    headTilt,
    syncAction,
    setMood,
    poke,
    dance,
    sing,
    send,
    openChat,
    closeChat,
  } = useCineMate();
  const [position] = React.useState<{ x: number; y: number }>({
    x: Math.max(24, window.innerWidth - 180),
    y: Math.max(24, window.innerHeight - 260),
  });

  const welcome = React.useMemo(() => WELCOME[Math.floor(Math.random() * WELCOME.length)], []);

  useEffect(() => {
    if (!ready) return;
    const analytics = {
      activeNow: data.activeNow,
      sessions: data.sessions,
      views: data.views,
      opens: data.opens,
      searches: data.searches,
      downloads: data.downloadClicks,
      firstLaunches: data.firstLaunches,
      averageSessionMs: data.averageSessionMs,
      hasDuration: data.hasDuration,
      titles: data.titles?.map((t) => ({ ...t, kind: t.kind as 'movie' | 'tv' })),
      platforms: data.surfaces?.map((s) => ({ name: s.name, sessions: s.sessions })),
      latestView: null,
      topTitle: null,
    };
    cineMateCore.onAnalyticsUpdate(analytics);
  }, [data, ready]);

  useEffect(() => {
    if (ready && messages.length === 0 && !open) {
      const msg = cineMateCore.sendInput(welcome);
      setMood(msg.mood);
    }
  }, [ready, open]);

  const bubbleText = React.useMemo(() => {
    if (!ready) return 'Connecting…';
    if (open) return 'Chatting with Cine';
    return `${surfaceLabel} · ${days}d`;
  }, [ready, open, surfaceLabel, days]);

  return (
    <>
      <div className="cm-dashboard-overlay">
        <div className="cm-pet-bubble" role="status" aria-live="polite">
          Cine · {bubbleText}
        </div>
        <CineMate
          mode="dashboard"
          position={position}
          accent={accent}
          mood={mood}
          eyelids={eyelids}
          mouth={mouth}
          headTilt={headTilt}
          syncAction={syncAction}
          onPoke={poke}
        />
      </div>

      <CineMateChat
        open={open}
        messages={messages}
        input=""
        onSend={(t) => {
          const reply = send(t);
          if (reply) setMood(reply.mood);
          if (reply?.action === 'dance') dance();
          if (reply?.action === 'sing') sing();
        }}
        onClose={closeChat}
        accent={accent}
      />

      <button type="button" className="cm-dock" onClick={open ? closeChat : openChat} aria-label="Chat with Cine">
        <span className="cm-dock-dot" /> Ask Cine
      </button>
    </>
  );
}
