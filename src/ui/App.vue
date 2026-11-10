<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { loadSiteCookies, type SiteCookies } from '../services/cookies';
import { countSiteData, inspectPage } from '../services/pageStorage';
import { describeTab, tabIdFromQuery, type TargetTab } from '../services/tab';
import { domainMatches, stripLeadingDot } from '../utils/domain';
import { t } from '../utils/i18n';
import { toastError } from './composables/feedback';
import { initialTarget } from './prefetch';
import ClearSiteDialog from './components/ClearSiteDialog.vue';
import CookieTable from './components/CookieTable.vue';
import EncodingSelect from './components/EncodingSelect.vue';
import FeedbackHost from './components/FeedbackHost.vue';
import Icon from './components/Icon.vue';
import SiteDataPanel from './components/SiteDataPanel.vue';
import StorageTable from './components/StorageTable.vue';
import UpdateBanner from './components/UpdateBanner.vue';

const props = defineProps<{ mode: 'popup' | 'sidepanel' }>();

type TabKey = 'cookies' | 'localStorage' | 'sessionStorage' | 'siteData';
const TAB_STORAGE_KEY = 'keinepad.activeTab';

const target = shallowRef<TargetTab>();
const resolved = ref(false);
/** The first view has its data (or there is none to show); background work waits for this. */
const settled = ref(false);
const cookies = shallowRef<SiteCookies | null>(null);
const cookiesLoading = ref(false);
const refreshToken = ref(0);
const counts = ref<Record<TabKey, number | null>>({
  cookies: null,
  localStorage: null,
  sessionStorage: null,
  siteData: null,
});
/** The encoding the page is decoded with, shown by the encoding dropdown. */
const charset = ref<string>();
const activeTab = ref<TabKey>(readSavedTab());
// A panel is created when its tab is first opened. Until then (and whenever it is hidden)
// its badge comes from the page overview instead of the panel's own, much heavier, listing.
const opened = reactive(new Set<TabKey>([activeTab.value]));
const showClear = ref(false);

// The toolbar popup and the side panel are only shown once their document has loaded, and an
// image requested before that holds the load event back until it has arrived — for a site's
// icon that can be a slow network request. So the header icon is added after the page is up.
const pageLoaded = ref(document.readyState === 'complete');
if (!pageLoaded.value) {
  window.addEventListener('load', () => (pageLoaded.value = true), { once: true });
}

function readSavedTab(): TabKey {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === 'cookies' || saved === 'localStorage' || saved === 'sessionStorage' || saved === 'siteData') {
      return saved;
    }
  } catch {
    /* storage unavailable */
  }
  return 'cookies';
}

function selectTab(key: TabKey) {
  activeTab.value = key;
  opened.add(key);
  try {
    localStorage.setItem(TAB_STORAGE_KEY, key);
  } catch {
    /* storage unavailable */
  }
}

const supported = computed(() => target.value?.support === 'ok');

// `short` labels are used when the side panel is narrow.
const tabs: { key: TabKey; label: string; short: string }[] = [
  { key: 'cookies', label: 'Cookies', short: 'Cookies' },
  { key: 'localStorage', label: 'Local Storage', short: 'Local' },
  { key: 'sessionStorage', label: 'Session Storage', short: 'Session' },
  { key: 'siteData', label: t('tabSiteData'), short: t('tabSiteData') },
];

const iconSrc = computed(() => {
  if (!pageLoaded.value || !resolved.value) return undefined;
  return (supported.value && target.value?.favIconUrl) || '/icons/icon-32.png';
});

let cookieRequest = 0;
async function loadCookies() {
  // Counting here also discards a load that is still in flight for a previous tab or URL.
  const request = ++cookieRequest;
  const current = target.value;
  if (!current || current.support !== 'ok') {
    cookiesLoading.value = false;
    return;
  }
  cookiesLoading.value = true;
  try {
    const loaded = await loadSiteCookies(current);
    if (request !== cookieRequest) return;
    cookies.value = loaded;
    counts.value.cookies = loaded.cookies.length;
  } catch (err) {
    if (request === cookieRequest) toastError(err);
  } finally {
    if (request === cookieRequest) cookiesLoading.value = false;
  }
}

// What the header and the badges of unopened tabs show comes from two cheap looks at the page.
let pageRequest = 0;
function loadPageInfo() {
  const request = ++pageRequest;
  const current = target.value;
  if (!current || current.support !== 'ok') return;
  const fresh = () => request === pageRequest;
  inspectPage(current.tabId).then(
    (page) => {
      if (!fresh()) return;
      charset.value = page.charset;
      counts.value.localStorage = page.localStorage;
      counts.value.sessionStorage = page.sessionStorage;
    },
    () => {
      // Pages that cannot be scripted (browser error pages, the PDF viewer…) count as empty.
      if (!fresh()) return;
      charset.value = undefined;
      counts.value.localStorage = 0;
      counts.value.sessionStorage = 0;
    },
  );
  countSiteData(current.tabId)
    .catch(() => 0)
    .then((n) => {
      if (fresh()) counts.value.siteData = n;
    });
}

watch([() => target.value?.tabId, () => target.value?.url, refreshToken], loadPageInfo);

function setTarget(next: TargetTab | undefined): Promise<void> {
  const changed = next?.tabId !== target.value?.tabId || next?.url !== target.value?.url;
  target.value = next;
  resolved.value = true;
  if (changed) {
    cookies.value = null;
    counts.value = { cookies: null, localStorage: null, sessionStorage: null, siteData: null };
  }
  return loadCookies();
}

function refreshAll() {
  refreshToken.value++;
  loadCookies();
}

function openSidePanel() {
  if (!target.value) return;
  // Must run synchronously inside the click handler to keep the user gesture.
  chrome.sidePanel
    .open({ windowId: target.value.windowId })
    .then(() => window.close())
    .catch(toastError);
}

function onCleared() {
  showClear.value = false;
  refreshAll();
}

// --- live updates -------------------------------------------------------------
let cookieTimer: ReturnType<typeof setTimeout> | undefined;
function onCookieChanged({ cookie }: chrome.cookies.CookieChangeInfo) {
  const root = cookies.value?.siteRoot;
  // Ignore churn from unrelated sites; partitioned cookies may belong to this top-level site.
  if (root && !domainMatches(root, stripLeadingDot(cookie.domain)) && !cookie.partitionKey) return;
  clearTimeout(cookieTimer);
  cookieTimer = setTimeout(loadCookies, 250);
}

function onTabUpdated(tabId: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) {
  if (tabId !== target.value?.tabId) return;
  if (info.url || info.status === 'complete') {
    setTarget(describeTab(tab)).then(() => {
      if (info.status === 'complete') refreshToken.value++;
    });
  }
}

let windowId: number | undefined;
async function onTabActivated(info: chrome.tabs.OnActivatedInfo) {
  if (info.windowId !== windowId || tabIdFromQuery() !== undefined) return;
  setTarget(describeTab(await chrome.tabs.get(info.tabId)));
}

onMounted(() => {
  chrome.cookies.onChanged.addListener(onCookieChanged);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  if (props.mode === 'sidepanel') {
    chrome.tabs.onActivated.addListener(onTabActivated);
    // Tab switches are ignored until the window is known; it is not needed for the first view.
    chrome.windows.getCurrent().then(
      (win) => (windowId = win.id),
      () => undefined,
    );
  }
  // The tab lookup was sent before the app was set up (see prefetch.ts).
  initialTarget
    .then(setTarget, () => setTarget(undefined))
    .finally(() => (settled.value = true));
});

onBeforeUnmount(() => {
  chrome.cookies.onChanged.removeListener(onCookieChanged);
  chrome.tabs.onUpdated.removeListener(onTabUpdated);
  chrome.tabs.onActivated.removeListener(onTabActivated);
});

const unsupportedMessage = computed(() => {
  switch (target.value?.support) {
    case 'file':
      return t('unsupportedFile');
    case 'restricted':
      return t('unsupportedRestricted');
    default:
      return t('unsupportedNoTab');
  }
});
</script>

<template>
  <div class="app" :class="`mode-${mode}`">
    <header class="app-header">
      <img v-if="iconSrc" :key="iconSrc" class="favicon" :src="iconSrc" alt="" />
      <span v-else class="favicon" />
      <div class="site">
        <div class="site-host" data-testid="site-host">{{ supported ? target!.host : resolved ? 'Keinepad' : '' }}</div>
        <div class="site-origin muted" :title="target?.url">
          {{ supported ? target!.origin : target?.url || '' }}
          <span v-if="target?.incognito" class="badge badge-muted">{{ t('incognito') }}</span>
          <span v-if="cookies && cookies.siteRoot !== target?.host" class="badge badge-muted" :title="t('siteRootHint')">
            *.{{ cookies.siteRoot }}
          </span>
        </div>
      </div>
      <div class="header-actions">
        <EncodingSelect v-if="supported && target" :target="target" :refresh-token="refreshToken" :detected="charset" />
        <button type="button" class="icon-btn" :title="t('refresh')" :disabled="!supported" @click="refreshAll">
          <Icon name="refresh" />
        </button>
        <button
          v-if="mode === 'popup'"
          type="button"
          class="icon-btn"
          :title="t('openSidePanel')"
          data-testid="open-side-panel"
          @click="openSidePanel"
        >
          <Icon name="sidePanel" />
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="!supported"
          data-testid="open-clear-site"
          @click="showClear = true"
        >
          {{ t('clearSiteData') }}
        </button>
      </div>
    </header>
    <UpdateBanner :ready="settled" />

    <template v-if="supported && target">
      <nav class="tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="tab"
          :class="{ active: activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          :data-testid="`tab-${tab.key}`"
          @click="selectTab(tab.key)"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <span class="tab-label-short">{{ tab.short }}</span>
          <span v-if="counts[tab.key] !== null" class="count">{{ counts[tab.key] }}</span>
        </button>
      </nav>

      <main class="content">
        <CookieTable
          v-if="opened.has('cookies')"
          v-show="activeTab === 'cookies'"
          :target="target"
          :data="cookies"
          :loading="cookiesLoading"
          @changed="loadCookies"
        />
        <StorageTable
          v-if="opened.has('localStorage')"
          v-show="activeTab === 'localStorage'"
          kind="localStorage"
          :target="target"
          :refresh-token="refreshToken"
          :active="activeTab === 'localStorage'"
          @count="counts.localStorage = $event"
        />
        <StorageTable
          v-if="opened.has('sessionStorage')"
          v-show="activeTab === 'sessionStorage'"
          kind="sessionStorage"
          :target="target"
          :refresh-token="refreshToken"
          :active="activeTab === 'sessionStorage'"
          @count="counts.sessionStorage = $event"
        />
        <SiteDataPanel
          v-if="opened.has('siteData')"
          v-show="activeTab === 'siteData'"
          :target="target"
          :refresh-token="refreshToken"
          :active="activeTab === 'siteData'"
          @count="counts.siteData = $event"
        />
      </main>
    </template>
    <main v-else-if="resolved" class="content unsupported">
      <p>{{ unsupportedMessage }}</p>
    </main>

    <ClearSiteDialog
      v-if="showClear && target && supported"
      :target="target"
      :cookies="cookies?.cookies ?? []"
      @close="showClear = false"
      @cleared="onCleared"
    />
    <FeedbackHost />
  </div>
</template>
