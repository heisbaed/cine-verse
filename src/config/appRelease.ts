export interface AppRelease {
  version: string;
  buildNumber: string;
  fileSize: string;
  minAndroid: string;
  updatedAt: string;
  apkUrl: string;
  apkFileName: string;
  changelog: string[];
}

// DIRECT DOWNLOAD VIA GITHUB RELEASES:
// The Download button points straight at the .apk file URL below.
// Click = browser downloads immediately, no extra page opens.
// Rebuilt APK => re-upload to a new GitHub release, then paste the
// new browser_download_url here (and update version/fileSize).

export const APP_RELEASE: AppRelease = {
  version: '1.1.0',
  buildNumber: '2',
  fileSize: '~124 MB',
  minAndroid: 'Android 8.0+',
  updatedAt: 'September 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.1.0/cine-verse-v1.1.0.apk',
  apkFileName: 'cine-verse-v1.1.0.apk',
  changelog: [
    'New app icon — a cinema clapperboard mark (replaces the old play button)',
    'Cine AI moved to the center of the bottom nav with role-labelled bubbles and quick-nav chips',
    'Cine AI now knows what is trending, in theatres, and releasing soon via live TMDB data',
    'Fixed accent themes: all 10 presets and the hue slider now apply correct colors',
    'Resume playback now seeks to your saved spot instead of starting over',
    'Notifications: scheduled reminders now actually fire on Android',
    'Higher theme contrast so text stays readable in every dark/light scheme',
    'Grid cards play trailers on click (YouTube modal)',
    'About moved into Settings; bottom nav is now Home · Global · Cine AI · Upcoming · Bookmarks',
  ],
};

export const hasApkUrl = (): boolean => Boolean(APP_RELEASE.apkUrl);
