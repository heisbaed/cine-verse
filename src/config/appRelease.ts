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
  version: '1.1.1',
  buildNumber: '3',
  fileSize: '~45 MB',
  minAndroid: 'Android 8.0+',
  updatedAt: 'October 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.1.1/cine-verse-v1.1.1.apk',
  apkFileName: 'cine-verse-v1.1.1.apk',
  changelog: [
    'In-app updates — new APK versions download and install without leaving the app',
    'Cine AI fixed with faster replies, clear error messages, and Try again',
    'Torrent downloads now show every result with pages, most seeders first',
    'Two new servers (VidFast, VidSrc) — six playback choices in total',
    'Play, Download, and Trailer are now separate buttons',
    'Episode torrents refresh automatically when you switch episodes',
    'Upcoming shows future releases only, earliest first',
    'APK shrunk from ~124 MB to ~45 MB',
  ],
};

export const hasApkUrl = (): boolean => Boolean(APP_RELEASE.apkUrl);
