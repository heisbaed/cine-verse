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
  version: '1.2.10',
  buildNumber: '15',
  fileSize: '24.3 MB',
  minAndroid: 'Android 7.0+ · 64-bit ARM',
  updatedAt: '21 November 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.2.10/cine-verse-v1.2.10.apk',
  apkFileName: 'cine-verse-v1.2.10.apk',
  changelog: [
    'Removes the progress bar when a download finishes',
    'Restores Android download progress when you reopen Cineverse',
    'More complete season and episode listings where guide data is available',
    'Offline playback and single-file MP4 export from Downloads',
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

