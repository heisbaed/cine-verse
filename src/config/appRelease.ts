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

// DIRECT DOWNLOAD VIA GITHUB RELEASES (free, 2GB per file):
// The Download button points straight at the .apk file URL below.
// Click = browser downloads immediately, no GitHub page opens.
// For v2: upload the new APK to a new release (tag v2.0.0) and update
// version + apkUrl here.

export const APP_RELEASE: AppRelease = {
  version: '1.0.0',
  buildNumber: '1',
  fileSize: '~112 MB',
  minAndroid: 'Android 8.0+',
  updatedAt: 'September 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.0.0/cine-verse-v1.0.0.apk.apk',
  apkFileName: 'cine-verse-v1.0.0.apk',
  changelog: [
    'Browse trending movies, TV series, and upcoming releases',
    'Search with instant suggestions + genre and year filters',
    'Save titles to a synced watchlist',
    'Offline-friendly PWA caching for posters and details',
  ],
};

export const hasApkUrl = (): boolean => Boolean(APP_RELEASE.apkUrl);
