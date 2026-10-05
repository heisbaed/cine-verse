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
  version: '1.2.0',
  buildNumber: '5',
  fileSize: '~45 MB',
  minAndroid: 'Android 8.0+',
  updatedAt: 'October 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.2.0/cine-verse-v1.2.0.apk',
  apkFileName: 'cine-verse-v1.2.0.apk',
  changelog: [
    'Cine AI now grounds recommendations in live TMDB results',
    'Recommendation cards now match the exact titles and posters in the answer',
    'Cine AI understands released and upcoming titles, with dates and explanations',
    'Previous recommendations are excluded from later requests',
    'Working picture-in-picture — shrink any video into a floating window',
    'Follow shows and get notified when new episodes air',
    'App lock — fingerprint or PIN on every launch (optional)',
    'Cinema stats — time watched, top genres, most-watched title',
    'Home now opens with picks based on what you watched',
    'Vidlink moved last after hanging; slow networks get 30s per server',
    'Cine AI input floats above the keyboard like WhatsApp',
  ],
};

export const hasApkUrl = (): boolean => Boolean(APP_RELEASE.apkUrl);
