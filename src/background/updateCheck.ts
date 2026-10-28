import { checkForUpdate, isAutoCheckOn, newerRelease, refreshBadge, selfUpdateEnabled, setAutoCheck } from '../services/update';
import { t } from '../utils/i18n';

// Toolbar icon right-click menu: "Check for updates" and an "automatically" toggle.
const CHECK_ID = 'update:check';
const AUTO_ID = 'update:auto';

/** Called from the background entry after all menus were removed. */
export async function createUpdateMenus(): Promise<void> {
  if (!selfUpdateEnabled()) return;
  const create = (props: chrome.contextMenus.CreateProperties) =>
    chrome.contextMenus.create(props, () => void chrome.runtime.lastError);
  create({ id: CHECK_ID, title: t('menuCheckUpdate'), contexts: ['action'] });
  create({ id: AUTO_ID, title: t('menuAutoUpdate'), type: 'checkbox', checked: await isAutoCheckOn(), contexts: ['action'] });
}

// Shows a short-lived badge so a manual check from the menu gets visible feedback.
async function flashBadge(text: string, title: string): Promise<void> {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({ title });
  setTimeout(() => void refreshBadge(), 4000);
}

async function manualCheck(): Promise<void> {
  const state = await checkForUpdate(true);
  if (!state) return;
  if (newerRelease(state)) {
    // The popup shows the release details; fall back to the release page if it cannot open.
    await chrome.action.openPopup().catch(() => chrome.tabs.create({ url: state.latest!.pageUrl }));
  } else if (state.error) {
    await chrome.action.setBadgeBackgroundColor({ color: '#d93a3a' });
    await flashBadge('!', t('updateCheckFailed', state.error));
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: '#188a4a' });
    await flashBadge('✓', t('updateUpToDate', chrome.runtime.getManifest().version));
  }
}

// Service workers have no long-lived timers, so automatic checks piggyback on browser startup
// and tab switches; checkForUpdate itself skips the request unless the interval has passed.
let lastAttempt = 0;
function maybeCheck(): void {
  if (Date.now() - lastAttempt < 10 * 60e3) return;
  lastAttempt = Date.now();
  checkForUpdate().catch(console.error);
}

export function setupUpdateCheck(): void {
  if (!selfUpdateEnabled()) return;
  chrome.runtime.onInstalled.addListener(maybeCheck);
  chrome.runtime.onStartup.addListener(maybeCheck);
  chrome.tabs.onActivated.addListener(maybeCheck);

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === CHECK_ID) {
      manualCheck().catch(console.error);
    } else if (info.menuItemId === AUTO_ID) {
      setAutoCheck(Boolean(info.checked))
        .then(async () => void (info.checked ? await checkForUpdate() : await refreshBadge()))
        .catch(console.error);
    }
  });
}
