import { preloadCookieStores } from '../services/cookies';
import { getTargetTab } from '../services/tab';

/*
 * The first requests every view depends on. The entry imports this module before anything
 * else, so they are sent before Vue is even evaluated and their answers arrive while the app
 * mounts rather than after it.
 */
preloadCookieStores();

/** The tab the UI opens on. */
export const initialTarget = getTargetTab();
