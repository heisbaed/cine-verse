import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { CineMateMode, CineMateMood, CineMatePosition } from '@/types/cinemate';

interface CineMateHeadProps {
  mood: CineMateMood;
  eyelids: 'open' | 'closed' | 'half' | 'squint';
  mouth: 'neutral' | 'smile' | 'wide-smile' | 'frown' | 'surprised' | 'oh' | 'zip';
  headTilt: number;
}

const PUPIL_DRIFT = [
  [0, 0],
  [2.5, 1],
  [-2, -1.5],
  [0, 0],
];

const PUPIL_SCAN = [
  [-6, 0],
  [0, 0],
  [6, 0],
  [0, 0],
];

const Head: React.FC<CineMateHeadProps> = ({ mood, eyelids, mouth, headTilt }) => {
  const headRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = headRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const max = Math.min(rect.width, rect.height) / 2.4;
      const ratio = Math.min(dist, max) / max;
      const angle = Math.atan2(dy, dx);
      setMouseOffset({
        x: Math.cos(angle) * max * ratio,
        y: Math.sin(angle) * max * ratio,
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const eyeHeight =
    eyelids === 'closed' ? 4 : eyelids === 'half' ? 11 : eyelids === 'squint' ? 7 : 18;
  const eyeWidth = eyelids === 'closed' ? 16 : eyelids === 'half' ? 12 : 10;
  const pupilSize =
    mood === 'surprised' ? 5 : mood === 'thinking' ? 4 : mood === 'focused' ? 3.5 : 6.5;
  const pupilY =
    eyelids === 'closed' || eyelids === 'half' || eyelids === 'squint' ? 3 : 0;

  const pupilMove = () => {
    if (!mouseOffset) return null;
    const maxEx = 4.5;
    const maxEy = 9;
    return `translate(${Math.max(-maxEx, Math.min(maxEx, mouseOffset.x * 0.55))}px, ${Math.max(
      -maxEy,
      Math.min(maxEy, mouseOffset.y * 0.55),
    ) + pupilY}px)`;
  };

  const eyeContent = (key: string) => (
    <div className="cm-eye" key={key}>
      <motion.div
        className={`cm-pupil ${mood === 'reading' ? 'cm-scan' : ''}`}
        style={{
          width: `${pupilSize}px`,
          height: `${pupilSize}px`,
          transform: mood === 'idle' || mood === 'reading' || mood === 'focused'
            ? pupilMove()
            : undefined,
        }}
        animate={
          mood === 'reading'
            ? { transform: PUPIL_SCAN.map(([x, y]) => `translate(${x}px, ${y + pupilY}px)`) }
            : mood === 'idle' || mood === 'focused'
              ? { transform: PUPIL_DRIFT.map(([x, y]) => `translate(${x}px, ${y + pupilY}px)`) }
              : undefined
        }
        transition={
          mood === 'reading'
            ? { duration: 1.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
            : mood === 'idle' || mood === 'focused'
              ? { duration: 7, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              : { duration: 0.15, ease: 'easeOut' }
        }
      />
    </div>
  );

  const clipPath =
    eyelids === 'closed'
      ? 'polygon(0% 50%, 100% 50%, 100% 50%, 0% 50%)'
      : eyelids === 'half'
        ? 'polygon(0% 35%, 100% 35%, 100% 100%, 0% 100%)'
        : 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';

  return (
    <div ref={headRef} style={{ transform: `rotate(${headTilt}deg)` }}>
      <div className="cm-antenna" aria-hidden="true" />
      <div className="cm-ears">
        <div className="cm-ear" />
        <div className="cm-ear" />
      </div>
      <div
        className="cm-head"
        style={{
          '--cm-glow': 'currentColor',
        }}
      >
        <div className="cm-screen">
          <div className="cm-eyes">
            {eyeContent('left')}
            {eyeContent('right')}
          </div>
          <div
            className="cm-mouth"
            style={mouthStyle(mouth, eyelids, pupilSize, pupilY)}
          />
        </div>
      </div>
    </div>
  );
};

const mouthStyle = (
  mouth: Head['mouth'],
  eyelids: string,
  pupilSize: number,
  pupilY: number,
): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: 'absolute',
    bottom: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
  };
  switch (mouth) {
    case 'neutral':
      return { ...base, border: '2px solid', borderTopWidth: '2px', borderBottomWidth: '0px', borderRadius: '0px', height: '4px', width: '16px' };
    case 'smile':
      return { ...base, border: '3px solid', borderTopWidth: '0px', borderBottomWidth: '3px', borderTopLeftRadius: '0px', borderTopRightRadius: '0px', borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px', height: '10px', width: '18px' };
    case 'wide-smile':
      return { ...base, border: '3px solid', borderTopWidth: '0px', borderBottomWidth: '3px', borderTopLeftRadius: '0px', borderTopRightRadius: '0px', borderBottomLeftRadius: '18px', borderBottomRightRadius: '18px', height: '14px', width: '20px' };
    case 'frown':
      return { ...base, border: '3px solid', borderTopWidth: '3px', borderBottomWidth: '0px', borderTopLeftRadius: '14px', borderTopRightRadius: '14px', borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px', height: '10px', width: '18px' };
    case 'surprised':
      return { ...base, border: '2px solid', borderRadius: '50%', width: '10px', height: '10px' };
    case 'oh':
      return { ...base, border: '2px solid', borderRadius: '50%', width: '8px', height: '8px' };
    case 'zip':
      return { ...base, border: '0px', height: '4px', background: 'transparent', borderTop: '2px solid', width: '16px' };
    default:
      return { ...base, border: '2px solid', borderTopWidth: '2px', borderBottomWidth: '0px', borderRadius: '0px', height: '4px', width: '16px' };
  }
};

interface CineMateBodyProps {
  mood: CineMateMood;
  syncAction: 'dance' | 'sing' | null;
  reducedMotion: boolean;
}

const Body: React.FC<CineMateBodyProps> = ({ mood, syncAction, reducedMotion }) => {
  const bob =
    mood === 'idle' || mood === 'happy' || mood === 'excited' || mood === 'curious' || mood === 'focused';
  const bobY = mood === 'excited' ? -9 : -4;
  const bobDur = mood === 'excited' ? 0.7 : 3.4;

  let bodyAnim: typeof bob | undefined;
  if (syncAction === 'dance' && !reducedMotion) {
    bodyAnim = { rotate: [0, 15, -15, 15, -15, 0], y: [-4, -20, -4], scale: [1, 1.08, 1] };
  } else if (syncAction === 'sing' && !reducedMotion) {
    bodyAnim = { y: [-4, -10, -4], scale: [1, 1.04, 1] };
  } else if (bob && !reducedMotion) {
    bodyAnim = { y: [0, bobY, 0] };
  }

  return (
    <>
      <motion.div
        className="cm-torso"
        animate={bodyAnim}
        transition={{ duration: bobDur, ease: 'easeInOut', repeat: Infinity }}
      >
        <div className="cm-chest-led" />
        <div className="cm-arm left" aria-hidden="true" />
        <div className="cm-arm right" aria-hidden="true" />
      </motion.div>
      <div className="cm-base" aria-hidden="true">
        <div className="cm-base-ring" />
      </div>
    </>
  );
};

interface CineMateAuraProps {
  mood: CineMateMood;
  syncAction: 'dance' | 'sing' | null;
  closed: boolean;
  reducedMotion: boolean;
}

const Aura: React.FC<CineMateAuraProps> = ({ mood, syncAction, closed, reducedMotion }) => {
  if (mood === 'sleepy' || closed) return null;
  let auraAnim;
  if (syncAction === 'dance' && !reducedMotion) auraAnim = { scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] };
  else if (syncAction === 'sing' && !reducedMotion) auraAnim = { scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25] };
  else auraAnim = { scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] };
  return (
    <motion.div
      className="cm-aura"
      animate={auraAnim}
      transition={{ duration: syncAction === 'sing' ? 0.6 : 4, ease: 'easeInOut', repeat: Infinity }}
    />
  );
};

const modeScale: Record<CineMateMode, number> = {
  dashboard: 1,
  room: 1.35,
  gadget: 0.82,
  mini: 0.62,
};

interface CineMateProps {
  mode: CineMateMode;
  position?: CineMatePosition;
  accent: string;
  mood: CineMateMood;
  eyelids: 'open' | 'closed' | 'half' | 'squint';
  mouth: 'neutral' | 'smile' | 'wide-smile' | 'frown' | 'surprised' | 'oh' | 'zip';
  headTilt: number;
  syncAction: 'dance' | 'sing' | null;
  open?: boolean;
  minimized?: boolean;
  reducedMotion?: boolean;
  onPoke?: () => void;
}

const CineMate: React.FC<CineMateProps> = ({
  mode,
  position,
  accent,
  mood,
  eyelids,
  mouth,
  headTilt,
  syncAction,
  open,
  minimized,
  reducedMotion = false,
  onPoke,
}) => {
  const scale = modeScale[mode];
  const reduced = reducedMotion;

  const handleClick = useCallback(() => {
    onPoke?.();
  }, [onPoke]);

  // --- Dragging logic ---
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (position) setPos(position);
  }, [position]);

  const clampPos = (x: number, y: number) => ({
    x: Math.min(Math.max(x, 8), window.innerWidth - 96),
    y: Math.min(Math.max(y, 64), document.body.scrollHeight - 140),
  });

  const startDrag = useCallback((e: PointerEvent) => {
    if (!posRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragState.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
      moved: false
    };
  }, []);

  const moveDrag = useCallback((e: PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.sx;
    const dy = e.clientY - st.sy;
    if (!st.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    st.moved = true;
    setPos(clampPos(st.ox + dx, st.oy + dy));
  }, []);

  const endDrag = useCallback((e: PointerEvent) => {
    const st = dragState.current;
    dragState.current = null;
    if (!st?.moved) {
      // tap/click -> poke
      onPoke?.();
    }
    // dragging ended
  }, []);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  return (
    <div
      className={`cm-pet cm-mode-${mode} cm-mood-${mood}${mood === 'excited' ? ' cm-excited' : ''}${minimized ? ' cm-mini' : ''}`}
      style={{
        position: 'absolute',
        left: pos?.x,
        top: pos?.y,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
        pointerEvents: 'auto',
        zIndex: 70,
        cursor: 'grab',
      }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <Aura mood={mood} syncAction={syncAction} closed={eyelids === 'closed'} reducedMotion={reduced} />
      <Head mood={mood} eyelids={eyelids} mouth={mouth} headTilt={headTilt} />
      <Body mood={mood} syncAction={syncAction} reducedMotion={reduced} />
    </div>
  );
};

export default CineMate;
