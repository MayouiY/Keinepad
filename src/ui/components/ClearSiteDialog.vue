<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { SiteCookie } from '../../services/cookies';
import { ALL_CLEAR_OPTIONS, clearSiteData, type ClearOptions } from '../../services/siteData';
import type { TargetTab } from '../../services/tab';
import { t, type MessageKey } from '../../utils/i18n';
import { toast, toastError } from '../composables/feedback';
import Modal from './Modal.vue';

const props = defineProps<{ target: TargetTab; cookies: SiteCookie[] }>();
const emit = defineEmits<{ close: []; cleared: [] }>();

const opts = reactive<ClearOptions>({ ...ALL_CLEAR_OPTIONS });
const reloadAfter = ref(true);
const busy = ref(false);

const items: { key: keyof ClearOptions; label: MessageKey }[] = [
  { key: 'cookies', label: 'clearOptCookies' },
  { key: 'localStorage', label: 'clearOptLocalStorage' },
  { key: 'sessionStorage', label: 'clearOptSessionStorage' },
  { key: 'indexedDB', label: 'clearOptIndexedDB' },
  { key: 'cacheStorage', label: 'clearOptCacheStorage' },
  { key: 'serviceWorkers', label: 'clearOptServiceWorkers' },
  { key: 'cache', label: 'clearOptHttpCache' },
];

const anySelected = computed(() => Object.values(opts).some(Boolean));

async function run() {
  busy.value = true;
  try {
    await clearSiteData(props.target, opts, props.cookies);
    if (reloadAfter.value) await chrome.tabs.reload(props.target.tabId, { bypassCache: true });
    toast(t('siteCleared'));
    emit('cleared');
  } catch (err) {
    toastError(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :title="t('clearSiteTitle')" @close="emit('close')">
    <p class="muted">{{ t('clearSiteMessage', target.origin) }}</p>
    <div class="check-list" data-testid="clear-options">
      <label v-for="item in items" :key="item.key" class="check">
        <input v-model="opts[item.key]" type="checkbox" :name="item.key" />
        <span>{{ t(item.label) }}</span>
        <small v-if="item.key === 'cookies'" class="muted">{{ t('cookieCountShort', [cookies.length]) }}</small>
      </label>
    </div>
    <label class="check reload-option">
      <input v-model="reloadAfter" type="checkbox" name="reloadAfter" />
      <span>{{ t('reloadAfterClear') }}</span>
    </label>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">{{ t('cancel') }}</button>
      <button
        type="button"
        class="btn btn-danger"
        :disabled="busy || !anySelected"
        data-testid="clear-site-confirm"
        @click="run"
      >
        {{ t('clearNow') }}
      </button>
    </template>
  </Modal>
</template>
