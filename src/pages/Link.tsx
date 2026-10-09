import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Monitor, AlertCircle } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuth } from '@/contexts/AuthContext';
import { approveTvPairing, readTvPairing, signInForTvLink, type TvPairingRequest } from '@/lib/tvPairing';

export default function LinkPage() {
  useSEO({ title: 'Link your TV', description: 'Approve your Cine-verse TV from your existing account.' });
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const { user, authLoading, authError, signInWithGoogle } = useAuth();
  const [request, setRequest] = useState<TvPairingRequest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRequest(null);
    if (!user || !/^[a-f0-9]{32}$/.test(code)) return;
    void readTvPairing(code).then((value) => {
      if (!cancelled) { setRequest(value); setError(''); }
    }).catch((failure: unknown) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : 'Could not load this TV request.');
    });
    return () => { cancelled = true; };
  }, [code, user]);

  const approve = async () => {
    if (!user || !request) return;
    setBusy(true); setError('');
    try { await approveTvPairing(code, user); setLinked(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Linking failed. Please try again.'); }
    finally { setBusy(false); }
  };

  const validCode = /^[a-f0-9]{32}$/.test(code);
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full rounded-2xl bg-surface border border-white/10 p-8 text-center">
        {linked ? <Check className="w-14 h-14 text-emerald mx-auto mb-5" /> : <Monitor className="w-14 h-14 text-gold mx-auto mb-5" />}
        <h1 className="text-3xl font-black mb-4">{linked ? 'TV linked' : 'Link your TV'}</h1>
        <p className="text-white/65 leading-7 mb-6">
          {linked ? 'Return to your TV. It will import your account watchlist. Watching as a guest remains available.'
            : validCode ? 'Only approve if you just scanned the QR code displayed on your own TV. This lets that TV read and update your account watchlist.'
              : 'On your TV, open Settings → Link account, then scan the QR code with your phone camera. No in-app scanner is needed.'}
        </p>
        {validCode && !linked && (authLoading ? <p>Checking your account…</p> : !user ? (
          <>
            <button onClick={() => void signInWithGoogle()} className="w-full rounded-lg bg-gold text-background font-bold py-3">Sign in with Google</button>
            <form className="mt-5 space-y-3 text-left" onSubmit={(event) => {
              event.preventDefault(); setBusy(true); setError('');
              void signInForTvLink(email, password).catch((failure: unknown) => {
                setError(failure instanceof Error ? failure.message : 'Email sign-in failed.');
              }).finally(() => { setPassword(''); setBusy(false); });
            }}>
              <p className="text-sm text-white/60">Or use the email account from your mobile app:</p>
              <label className="block text-sm">Email<input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="block w-full mt-1 p-3 rounded-lg bg-white/5 border border-white/10" /></label>
              <label className="block text-sm">Password<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="block w-full mt-1 p-3 rounded-lg bg-white/5 border border-white/10" /></label>
              <button disabled={busy} className="w-full rounded-lg border border-white/20 font-bold py-3 disabled:opacity-40">{busy ? 'Signing in…' : 'Sign in with email'}</button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-white/60 mb-5">Signed in as {user.email || user.displayName || 'your Cine-verse account'}. Use the same account as your mobile app.</p>
            <button disabled={busy || !request} onClick={() => void approve()} className="w-full rounded-lg bg-gold text-background font-bold py-3 disabled:opacity-40">{busy ? 'Linking…' : request ? 'Approve this TV' : 'Loading TV request…'}</button>
          </>
        ))}
        {(error || authError) && <p role="alert" className="mt-5 text-sm text-ruby"><AlertCircle className="inline w-4 h-4 mr-1" />{error || authError}</p>}
        {!linked && <p className="text-xs text-white/40 mt-6">TV requests expire after 10 minutes. Account linking is optional.</p>}
      </div>
    </div>
  );
}
