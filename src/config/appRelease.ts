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
  version: '1.2.3',
  buildNumber: '8',
  fileSize: '~45 MB',
  minAndroid: 'Android 8.0+',
  updatedAt: 'October 2026',
  apkUrl:
    'https://github.com/heisbaed/cine-verse/releases/download/v1.2.3/cine-verse-v1.2.3.apk',
  apkFileName: 'cine-verse-v1.2.3.apk',
  changelog: [
    'Update loops fixed — downloads and patches now recover and apply reliably',
    'Cine AI answers grounded in live results, including franchises and stories',
    'Torrent downloads search two indexes with quality filters, sorting, and pages',
    'Minimalist torrent UI with tap-to-select dropdowns and magnet-first actions',
    'Working picture-in-picture — shrink any video into a floating window',
    'Follow shows and get notified when new episodes air',
    'App lock — fingerprint or PIN on every launch (optional)',
    'Cinema stats — time watched, top genres, most-watched title',
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

