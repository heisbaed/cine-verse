import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { useViewHistoryStore } from '@/store/viewHistoryStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import type { MediaItem } from '@/types/tmdb';
import { getMediaType } from '@/utils/media';

type SyncStatus = 'guest' | 'syncing' | 'synced' | 'offline';

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  syncStatus: SyncStatus;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
}

interface CloudUserData {
  watchlist?: MediaItem[];
  recentlyViewed?: MediaItem[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isMediaItem = (value: unknown): value is MediaItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'number' &&
    (typeof item.title === 'string' || typeof item.name === 'string')
  );
};

const mergeMedia = (
  primary: MediaItem[],
  secondary: MediaItem[],
  limit?: number,
): MediaItem[] => {
  const seen = new Set<string>();
  const merged = [...primary, ...secondary].filter((item) => {
    const key = `${getMediaType(item)}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return typeof limit === 'number' ? merged.slice(0, limit) : merged;
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('guest');

  useEffect(() => {
    let disposed = false;
    let syncGeneration = 0;
    let stopAuth: (() => void) | undefined;
    let stopWatchlistSync: (() => void) | undefined;
    let stopHistorySync: (() => void) | undefined;
    let writeTimer: ReturnType<typeof setTimeout> | undefined;

    const stopCloudSync = () => {
      syncGeneration += 1;
      stopWatchlistSync?.();
      stopHistorySync?.();
      stopWatchlistSync = undefined;
      stopHistorySync = undefined;
      if (writeTimer) clearTimeout(writeTimer);
    };

    const startCloudSync = async (currentUser: User) => {
      stopCloudSync();
      const generation = syncGeneration;
      setSyncStatus('syncing');

      try {
        const database = await import('firebase/database');
        if (disposed || generation !== syncGeneration) return;
        const db = database.getDatabase(firebaseApp);
        const userRef = database.ref(db, `users/${currentUser.uid}`);
        const snapshot = await database.get(userRef);
        if (disposed || generation !== syncGeneration) return;

        const remoteData = snapshot.exists()
          ? (snapshot.val() as CloudUserData)
          : {};
        const remoteWatchlist = Array.isArray(remoteData.watchlist)
          ? remoteData.watchlist.filter(isMediaItem)
          : [];
        const remoteHistory = Array.isArray(remoteData.recentlyViewed)
          ? remoteData.recentlyViewed.filter(isMediaItem)
          : [];
        const mergedWatchlist = mergeMedia(
          useWatchlistStore.getState().watchlist,
          remoteWatchlist,
        );
        const mergedHistory = mergeMedia(
          useViewHistoryStore.getState().recentlyViewed,
          remoteHistory,
          20,
        );

        useWatchlistStore.getState().setWatchlist(mergedWatchlist);
        useViewHistoryStore.getState().setRecentlyViewed(mergedHistory);

        await database.update(userRef, {
            displayName: currentUser.displayName || '',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            watchlist: mergedWatchlist,
            recentlyViewed: mergedHistory,
            updatedAt: database.serverTimestamp(),
          });
        if (disposed || generation !== syncGeneration) return;

        const scheduleWrite = () => {
          if (writeTimer) clearTimeout(writeTimer);
          writeTimer = setTimeout(async () => {
            try {
              await database.update(userRef, {
                  watchlist: useWatchlistStore.getState().watchlist,
                  recentlyViewed:
                    useViewHistoryStore.getState().recentlyViewed,
                  updatedAt: database.serverTimestamp(),
                });
              if (!disposed && generation === syncGeneration) {
                setSyncStatus('synced');
              }
            } catch {
              if (!disposed && generation === syncGeneration) {
                setSyncStatus('offline');
              }
            }
          }, 700);
        };

        stopWatchlistSync = useWatchlistStore.subscribe(scheduleWrite);
        stopHistorySync = useViewHistoryStore.subscribe(scheduleWrite);
        setSyncStatus('synced');
      } catch {
        if (!disposed && generation === syncGeneration) {
          setSyncStatus('offline');
        }
      }
    };

    const initializeAuth = async () => {
      try {
        const firebaseAuth = await import('firebase/auth');
        if (disposed) return;
        const auth = firebaseAuth.getAuth(firebaseApp);
        await firebaseAuth.setPersistence(
          auth,
          firebaseAuth.browserLocalPersistence,
        );
        void firebaseAuth.getRedirectResult(auth).catch(() => {
          if (!disposed) {
            setAuthError('Google sign-in could not be completed.');
          }
        });

        stopAuth = firebaseAuth.onAuthStateChanged(auth, (currentUser) => {
          if (disposed) return;
          setUser(currentUser);
          setAuthLoading(false);
          setAuthError(null);
          if (currentUser) {
            void startCloudSync(currentUser);
          } else {
            stopCloudSync();
            setSyncStatus('guest');
          }
        });
      } catch {
        if (!disposed) {
          setAuthLoading(false);
          setAuthError('Account services are temporarily unavailable.');
        }
      }
    };

    void initializeAuth();
    return () => {
      disposed = true;
      stopAuth?.();
      stopCloudSync();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const firebaseAuth = await import('firebase/auth');
    const auth = firebaseAuth.getAuth(firebaseApp);
    const provider = new firebaseAuth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await firebaseAuth.signInWithPopup(auth, provider);
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await firebaseAuth.signInWithRedirect(auth, provider);
        return;
      }
      setAuthError('Google sign-in failed. Please try again.');
    }
  };

  const logOut = async () => {
    setAuthError(null);
    const firebaseAuth = await import('firebase/auth');
    await firebaseAuth.signOut(firebaseAuth.getAuth(firebaseApp));
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authLoading,
      authError,
      syncStatus,
      signInWithGoogle,
      logOut,
    }),
    [user, authLoading, authError, syncStatus],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
