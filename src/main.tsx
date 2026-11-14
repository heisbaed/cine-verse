import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { hydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { notifyUpdateAvailable, setSwUpdater } from './lib/swUpdate';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const queryState = document.getElementById('cineverse-query-state');
if (queryState?.textContent) {
  try {
    hydrate(queryClient, JSON.parse(queryState.textContent));
  } catch {
    // A stale or incomplete snapshot can still load the catalog normally.
  }
  queryState.remove();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    notifyUpdateAvailable();
  },
  onRegisteredSW(_url, registration) {
    // Poll for updates while the tab stays open so long sessions still learn
    // about new releases without waiting for the next visit.
    if (registration) {
      window.setInterval(() => {
        void registration.update().catch(() => undefined);
      }, 60 * 60 * 1000);
    }
  },
});

// updateSW(true) activates the waiting worker, then reloads into it.
setSwUpdater(() => {
  void updateSW(true);
});
