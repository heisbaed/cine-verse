/**
 * Bridges vite-plugin-pwa's service-worker lifecycle into React.
 * main.tsx registers the callbacks; UI subscribes to availability and
 * applies the waiting worker on user tap.
 */
let applyUpdate: (() => void) | null = null;

export const UPDATE_EVENT = 'cineverse:sw-update-available';

export function setSwUpdater(fn: () => void): void {
  applyUpdate = fn;
}

export function notifyUpdateAvailable(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }
}

export function applySwUpdate(): void {
  if (applyUpdate) {
    applyUpdate();
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
