/**
 * Where self-update checks look for new versions. Only builds installed outside a store
 * (no `update_url` in the installed manifest) check this; store builds are updated by the store.
 * To move releases elsewhere, change this one object.
 */
export const RELEASE_SOURCE = {
  /** GitHub REST endpoint returning the newest non-draft, non-prerelease release. */
  latestApi: 'https://api.github.com/repos/MayouiY/Keinepad/releases/latest',
  /** Human-readable releases page, used when a release has no zip asset. */
  releasesPage: 'https://github.com/MayouiY/Keinepad/releases',
  /** Release asset to offer for download. */
  assetPattern: /^keinepad-.*\.zip$/,
};

/** Minimum time between automatic checks. */
export const UPDATE_CHECK_INTERVAL_MS = 12 * 3600e3;
