<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  clearStorage,
  listStorage,
  removeStorageItems,
  setStorageItem,
  type StorageEntry,
  type StorageKind,
} from '../../services/pageStorage';
import type { TargetTab } from '../../services/tab';
import { byteSize, formatBytes, tryJsonPretty } from '../../utils/decode';
import { t } from '../../utils/i18n';
import { confirm, copyText, downloadText, toast, toastError } from '../composables/feedback';
import Icon from './Icon.vue';
import Modal from './Modal.vue';
import ValuePreview from './ValuePreview.vue';

const props = defineProps<{ target: TargetTab; kind: StorageKind; refreshToken: number }>();
const emit = defineEmits<{ count: [n: number] }>();

const entries = ref<StorageEntry[]>([]);
const error = ref('');
const loading = ref(false);
const query = ref('');
const editing = ref<{ original?: StorageEntry } | null>(null);
const form = reactive({ key: '', value: '' });

async function load() {
  loading.value = true;
  try {
    entries.value = await listStorage(props.target.tabId, props.kind);
    error.value = '';
  } catch (err) {
    entries.value = [];
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
    emit('count', entries.value.length);
  }
}

watch(() => [props.target.tabId, props.target.url, props.kind, props.refreshToken], load, { immediate: true });

const entrySize = (e: StorageEntry) => byteSize(e.key) + byteSize(e.value);

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return entries.value
    .filter((e) => !q || e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
    .sort((a, b) => a.key.localeCompare(b.key));
});
const totalSize = computed(() => entries.value.reduce((n, e) => n + entrySize(e), 0));

function openEditor(original?: StorageEntry) {
  form.key = original?.key ?? '';
  form.value = original?.value ?? '';
  editing.value = { original };
}

function formatJson() {
  const pretty = tryJsonPretty(form.value);
  if (pretty) form.value = pretty;
}

function minifyJson() {
  try {
    form.value = JSON.stringify(JSON.parse(form.value));
  } catch {
    /* not JSON */
  }
}

async function save() {
  if (!form.key) return toast(t('errKeyRequired'), 'error');
  try {
    await setStorageItem(props.target.tabId, props.kind, form.key, form.value, editing.value?.original?.key);
    toast(t('storageSaved'));
    editing.value = null;
    await load();
  } catch (err) {
    toastError(err);
  }
}

async function remove(keys: string[]) {
  try {
    await removeStorageItems(props.target.tabId, props.kind, keys);
    toast(t('storageDeleted', [keys.length]));
    await load();
  } catch (err) {
    toastError(err);
  }
}

async function clearAll() {
  const ok = await confirm({
    title: t('clearStorageTitle', props.kind),
    message: t('clearStorageMessage', props.target.origin),
    confirmText: t('clear'),
    danger: true,
  });
  if (!ok) return;
  try {
    // Clearing a filtered view only removes the visible keys.
    if (query.value.trim()) await removeStorageItems(props.target.tabId, props.kind, visible.value.map((e) => e.key));
    else await clearStorage(props.target.tabId, props.kind);
    toast(t('storageCleared'));
    await load();
  } catch (err) {
    toastError(err);
  }
}

function exportJson() {
  const obj = Object.fromEntries(visible.value.map((e) => [e.key, e.value]));
  downloadText(`${props.kind}-${props.target.host}.json`, JSON.stringify(obj, null, 2));
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <input v-model="query" class="search" type="search" :placeholder="t('searchKeys')" />
      <button type="button" class="btn btn-primary" data-testid="storage-add" @click="openEditor()">+ {{ t('add') }}</button>
    </div>
    <div class="list-head">
      <span class="muted">{{ t('storageCount', [visible.length, formatBytes(totalSize)]) }}</span>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" :disabled="!visible.length" @click="exportJson">{{ t('export') }}</button>
      <button
        type="button"
        class="btn btn-danger-ghost"
        :disabled="!visible.length"
        data-testid="storage-clear"
        @click="clearAll"
      >
        {{ t('clearAll') }}
      </button>
    </div>
    <p v-if="error" class="error-box">{{ t('pageAccessError') }} {{ error }}</p>
    <p v-else-if="!loading && !visible.length" class="empty">{{ entries.length ? t('noMatches') : t('noStorage') }}</p>
    <ul class="rows" data-testid="storage-list">
      <li v-for="e in visible" :key="e.key" class="row" :data-key="e.key" @click="openEditor(e)">
        <div class="row-main">
          <div class="row-title">
            <span class="name mono">{{ e.key }}</span>
            <span class="value mono" :title="e.value">{{ e.value }}</span>
          </div>
          <div class="row-meta">
            <span>{{ formatBytes(entrySize(e)) }}</span>
          </div>
        </div>
        <div class="row-actions">
          <button type="button" class="icon-btn" :title="t('copyValue')" @click.stop="copyText(e.value, t('copied'))">
            <Icon name="copy" />
          </button>
          <button type="button" class="icon-btn danger" :title="t('delete')" @click.stop="remove([e.key])"><Icon name="trash" /></button>
        </div>
      </li>
    </ul>

    <Modal v-if="editing" :title="editing.original ? t('editItem') : t('addItem')" wide @close="editing = null">
      <form class="form" @submit.prevent="save">
        <label class="field">
          <span>{{ t('key') }}</span>
          <input v-model="form.key" class="mono" name="key" spellcheck="false" autocomplete="off" />
        </label>
        <label class="field">
          <span>
            {{ t('colValue') }}
            <small class="muted">{{ formatBytes(byteSize(form.value)) }}</small>
          </span>
          <textarea v-model="form.value" class="mono" name="value" rows="8" spellcheck="false" />
        </label>
        <div class="chip-row">
          <button type="button" class="chip" @click="formatJson">{{ t('formatJson') }}</button>
          <button type="button" class="chip" @click="minifyJson">{{ t('minifyJson') }}</button>
        </div>
        <ValuePreview :value="form.value" />
      </form>
      <template #footer>
        <button type="button" class="btn" @click="editing = null">{{ t('cancel') }}</button>
        <button type="button" class="btn btn-primary" data-testid="storage-save" @click="save">{{ t('save') }}</button>
      </template>
    </Modal>
  </div>
</template>
