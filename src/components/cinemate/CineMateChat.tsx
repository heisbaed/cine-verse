import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X } from 'lucide-react';
import type { CineMateMessage } from '@/types/cinemate';

interface CineMateChatProps {
  open: boolean;
  messages: CineMateMessage[];
  input: string;
  onSend: (text: string) => void;
  onClose: () => void;
  accent: string;
}

const CHIPS = ['Summarize', 'Top titles', 'Platforms', 'Trend', 'Joke', 'Fact'];

const CineMateChat: React.FC<CineMateChatProps> = ({
  open,
  messages,
  input,
  onSend,
  onClose,
  accent,
}) => {
  const [local, setLocal] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!local.trim()) return;
    onSend(local);
    setLocal('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="dialog"
          aria-modal="false"
          aria-label="Chat with Cine about the analytics"
          className="cm-chat"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ duration: 0.22 }}
        >
          <header>
            <div className="cm-chat-pet" />
            <div>
              <strong>Cine</strong>
              <small>Online · your cinematic companion</small>
            </div>
            <button type="button" onClick={onClose} aria-label="Close Cine chat"><X size={16} /></button>
          </header>
          <div className="cm-chat-log" role="log" aria-live="polite">
            {messages.map((m) => (
              <p key={m.id} className={m.from}>
                {m.from === 'cine' && <Sparkles size={12} aria-hidden="true" />}
                {m.text}
              </p>
            ))}
            <div ref={endRef} />
          </div>
          <div className="cm-chips">
            {CHIPS.map((chip) => (
              <button key={chip} type="button" onClick={() => onSend(chip)}>{chip}</button>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="cm-input" className="sr-only">Ask Cine</label>
            <input
              id="cm-input"
              ref={inputRef}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ask Cine… e.g. sing for me?"
              autoComplete="off"
            />
            <button type="submit" aria-label="Send to Cine"><Send size={15} /></button>
          </form>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default CineMateChat;
