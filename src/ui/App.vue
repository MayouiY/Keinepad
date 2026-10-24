<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { loadSiteCookies, type SiteCookies } from '../services/cookies';
import { describeTab, getTargetTab, tabIdFromQuery, type TargetTab } from '../services/tab';
import { domainMatches, stripLeadingDot } from '../utils/domain';
import { t } from '../utils/i18n';
import { toastError } from './composables/feedback';
import ClearSiteDialog from './components/ClearSiteDialog.vue';
import CookieTable from './components/CookieTable.vue';
import FeedbackHost from './components/FeedbackHost.vue';
import Icon from './components/Icon.vue';
import SiteDataPanel from './components/SiteDataPanel.vue';
import StorageTable from './components/StorageTable.vue';

const props = defineProps<{ mode: 'popup' | 'sidepanel' }>();

type TabKey = 'cookies' | 'localStorage' | 'sessionStorage' | 'siteData';
const TAB_STORAGE_KEY = 'keinepad.activeTab';

const target = shallowRef<TargetTab>();
const resolved = ref(false);
const cookies = shallowRef<SiteCookies | null>(null);
const cookiesLoading = ref(false);
const refreshToken = ref(0);
const counts = ref<Record<TabKey, number | null>>({
  cookies: null,
  localStorage: null,
  sessionStorage: null,
  siteData: null,
});
const activeTab = ref<TabKey>(readSavedTab());
const showClear = ref(false);

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

async function loadCookies() {
  if (!target.value || !supported.value) return;
  cookiesLoading.value = true;
  try {
    cookies.value = await loadSiteCookies(target.value);
    counts.value.cookies = cookies.value.cookies.length;
  } catch (err) {
    toastError(err);
  } finally {
    cookiesLoading.value = false;
  }
}

async function setTarget(next: TargetTab | undefined) {
  const changed = next?.tabId !== target.value?.tabId || next?.url !== target.value?.url;
  target.value = next;
  resolved.value = true;
  if (changed) {
    cookies.value = null;
    counts.value = { cookies: null, localStorage: null, sessionStorage: null, siteData: null };
  }
  await loadCookies();
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

onMounted(async () => {
  chrome.cookies.onChanged.addListener(onCookieChanged);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  if (props.mode === 'sidepanel') {
    windowId = (await chrome.windows.getCurrent()).id;
    chrome.tabs.onActivated.addListener(onTabActivated);
  }
  await setTarget(await getTargetTab());
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
      <img v-if="target?.favIconUrl && supported" class="favicon" :src="target.favIconUrl" alt="" />
      <img v-else class="favicon" src="/icons/icon-32.png" alt="" />
      <div class="site">
        <div class="site-host" data-testid="site-host">{{ supported ? target!.host : 'Keinepad' }}</div>
        <div class="site-origin muted" :title="target?.url">
          {{ supported ? target!.origin : target?.url || '' }}
          <span v-if="target?.incognito" class="badge badge-muted">{{ t('incognito') }}</span>
          <span v-if="cookies && cookies.siteRoot !== target?.host" class="badge badge-muted" :title="t('siteRootHint')">
            *.{{ cookies.siteRoot }}
          </span>
        </div>
      </div>
      <div class="header-actions">
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
          v-show="activeTab === 'cookies'"
          :target="target"
          :data="cookies"
          :loading="cookiesLoading"
          @changed="loadCookies"
        />
        <StorageTable
          v-show="activeTab === 'localStorage'"
          kind="localStorage"
          :target="target"
          :refresh-token="refreshToken"
          @count="counts.localStorage = $event"
        />
        <StorageTable
          v-show="activeTab === 'sessionStorage'"
          kind="sessionStorage"
          :target="target"
          :refresh-token="refreshToken"
          @count="counts.sessionStorage = $event"
        />
        <SiteDataPanel
          v-show="activeTab === 'siteData'"
          :target="target"
          :refresh-token="refreshToken"
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
