import { useState } from 'react';

export default function EpisodeJump({ season, episode, onSelect }: { season: number; episode: number; onSelect: (season: number, episode: number) => void }) {
  const [s, setS] = useState(String(season));
  const [e, setE] = useState(String(episode));
  return <details className="mt-4 text-sm">
    <summary className="cursor-pointer py-2 font-semibold text-gold" onClick={() => { setS(String(season)); setE(String(episode)); }}>Choose another episode</summary>
    <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={event => {
      event.preventDefault();
      const selectedSeason = Number(s), selectedEpisode = Number(e);
      if (!Number.isSafeInteger(selectedSeason) || !Number.isSafeInteger(selectedEpisode) || selectedSeason < 1 || selectedEpisode < 1) return;
      onSelect(selectedSeason, selectedEpisode);
      const details = event.currentTarget.closest('details'); if (details) details.open = false;
    }}>
      <label className="grid gap-2">Season<input aria-label="Season number" type="number" inputMode="numeric" min={1} max={9999} required value={s} onChange={event => setS(event.target.value)} className="w-24 rounded-xl border border-white/15 bg-background px-3 py-3 text-base outline-none focus:border-gold" /></label>
      <label className="grid gap-2">Episode<input aria-label="Episode number" type="number" inputMode="numeric" min={1} max={9999} required value={e} onChange={event => setE(event.target.value)} className="w-24 rounded-xl border border-white/15 bg-background px-3 py-3 text-base outline-none focus:border-gold" /></label>
      <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-black">Go</button>
    </form>
  </details>;
}
