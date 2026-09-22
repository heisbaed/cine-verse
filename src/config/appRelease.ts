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

// DIRECT DOWNLOAD VIA EAS BUILD ARTIFACT:
// The Download button points straight at the .apk file URL below.
// Click = browser downloads immediately, no extra page opens.
// Rebuilt APK => paste the new artifact URL here (and update version/fileSize).

export const APP_RELEASE: AppRelease = {
  version: '1.0.0',
  buildNumber: '1',
  fileSize: '~116 MB',
  minAndroid: 'Android 8.0+',
  updatedAt: 'September 2026',
  apkUrl:
    'https://expo.dev/artifacts/eas/jTYOnTqyhrgm0lSbs68kRvUJlardzd88enureChUFJQ.apk',
  apkFileName: 'cine-verse-v1.0.0.apk',
  changelog: [
    'Browse trending movies, TV series, and upcoming releases',
    'Search with instant suggestions + genre and year filters',
    'Save titles to a synced watchlist',
    'Offline-friendly PWA caching for posters and details',
  ],
};

export const hasApkUrl = (): boolean => Boolean(APP_RELEASE.apkUrl);
