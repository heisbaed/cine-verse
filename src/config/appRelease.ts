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
  version: '1.2.8',
  buildNumber: '13',
  fileSize: '24.1 MB',
  minAndroid: 'Android 7.0+ · 64-bit ARM',
  updatedAt: '20 November 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.2.8/cine-verse-v1.2.8.apk',
  apkFileName: 'cine-verse-v1.2.8.apk',
  changelog: [
    'Single-file MP4 export for saved downloads through the Android Save dialog',
    'Background export with progress notification and cancellation',
    'MP4 assembly while segments download, reused for later exports',
    'Refreshed shared playback source transport and backend list',
    'More resilient downloads with partial-segment retries and clearer errors',
    'Lighter glass navigation with transparent content edges',
    'Native player, captions and offline packages from 1.2.5 retained',
    'Compatible automatic OTA patches for future interface fixes',
  ],
};

export interface TvAppRelease {
  version: string;
  fileSize: string;
  minAndroid: string;
  updatedAt: string;
  apkUrl: string;
  apkFileName: string;
  changelog: string[];
}

export const TV_APP_RELEASE: TvAppRelease = {
  version: '1.0.0',
  fileSize: '~31 MB',
  minAndroid: 'Android TV 5.0+ (API 21)',
  updatedAt: 'November 2026',
  apkUrl:
    'https://github.com/heisbaed/cineverseTV/releases/download/v1.0.0/cineverse-tv-1.0.0-release.apk?download=1&v=1.0.0',
  apkFileName: 'cineverse-tv-1.0.0-release.apk',
  changelog: [
    'Cineverse TV rebrand — gold clapperboard icon, banner and splash on black',
    'Leanback Android TV launcher experience, built for the remote',
    'Profiles, resume watching, parental PIN and multiple stream providers',
    'About and support point to King Bae and ourcineverse.web.app',
  ],
};

export const hasApkUrl = (): boolean => Boolean(APP_RELEASE.apkUrl);

