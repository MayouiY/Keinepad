import { applyEncoding, clearTabEncoding, encodingGroupLabel, getEncodingOverride } from '../services/encoding';
import { describeTab } from '../services/tab';
import { ENCODINGS, encodingLabel, groupEncodings } from '../utils/encoding';
import { t } from '../utils/i18n';

// Right-click menu: Page encoding → Auto-detect / common encodings / More encodings → the rest.
const ROOT_ID = 'encoding';
const MORE_ID = 'encoding-more';
const AUTO_ID = 'encoding:auto';
const itemId = (name: string) => `encoding:${name}`;
const ITEM_IDS = [AUTO_ID, ...ENCODINGS.map((e) => itemId(e.name))];

/** Called from the background entry after all menus were removed. */
export function createEncodingMenus(): void {
  const create = (props: chrome.contextMenus.CreateProperties) =>
    chrome.contextMenus.create(props, () => void chrome.runtime.lastError);
  create({
    id: ROOT_ID,
    title: t('encodingMenu'),
    contexts: ['page', 'frame', 'selection', 'link', 'image'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  create({ id: AUTO_ID, parentId: ROOT_ID, type: 'radio', checked: true, title: t('encodingAuto') });
  create({ id: 'encoding-sep', parentId: ROOT_ID, type: 'separator' });
  for (const enc of ENCODINGS.filter((e) => e.common)) {
    create({
      id: itemId(enc.name),
      parentId: ROOT_ID,
      type: 'radio',
      checked: false,
      title: `${encodingGroupLabel(enc.group)} (${encodingLabel(enc)})`,
    });
  }
  create({ id: MORE_ID, parentId: ROOT_ID, title: t('encodingMore') });
  groupEncodings(ENCODINGS.filter((e) => !e.common)).forEach(([group, list], i) => {
    if (i > 0) create({ id: `encoding-sep-${group}`, parentId: MORE_ID, type: 'separator' });
    for (const enc of list) {
      create({
        id: itemId(enc.name),
        parentId: MORE_ID,
        type: 'radio',
        checked: false,
        title: `${encodingGroupLabel(group)} (${encodingLabel(enc)})`,
      });
    }
  });
  checkedId = AUTO_ID;
  syncActiveTab();
}

// Radio items split by separators/submenus form separate groups, so the checked state is
// kept in sync by hand for the active tab.
let checkedId: string | undefined;

function setChecked(id: string): void {
  if (id === checkedId) return;
  checkedId = id;
  for (const other of ITEM_IDS) {
    chrome.contextMenus.update(other, { checked: other === id }, () => void chrome.runtime.lastError);
  }
}

async function syncTab(tab: chrome.tabs.Tab | undefined): Promise<void> {
  const target = tab && describeTab(tab);
  if (!target || target.support !== 'ok') return setChecked(AUTO_ID);
  const override = await getEncodingOverride(target.tabId, target.host);
  setChecked(override ? itemId(override.name) : AUTO_ID);
}

async function syncActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await syncTab(tab);
}

export function setupEncodingMenu(): void {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId);
    if (!id.startsWith('encoding:') || !tab) return;
    const target = describeTab(tab);
    if (!target || target.support !== 'ok') return;
    const encoding = id === AUTO_ID ? undefined : id.slice('encoding:'.length);
    setChecked(id);
    applyEncoding(target.tabId, target.host, encoding).catch(console.error);
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then(syncTab, () => undefined);
  });
  chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
    if (tab.active && (info.url || info.status === 'complete')) syncTab(tab);
  });
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) syncActiveTab();
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabEncoding(tabId).catch(() => undefined);
  });
}
