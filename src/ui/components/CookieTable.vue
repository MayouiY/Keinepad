<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { importCookies, removeCookie, removeCookies, type SiteCookie, type SiteCookies } from '../../services/cookies';
import type { TargetTab } from '../../services/tab';
import { cookieSize, exportCookies, parseImport, toCookieHeader } from '../../utils/cookie';
import { formatBytes } from '../../utils/decode';
import { formatDateTime, formatRelative, t } from '../../utils/i18n';
import { confirm, copyText, toast, toastError } from '../composables/feedback';
import CookieEditor from './CookieEditor.vue';
import ExportMenu from './ExportMenu.vue';
import Icon from './Icon.vue';
import Modal from './Modal.vue';

const props = defineProps<{ target: TargetTab; data: SiteCookies | null; loading: boolean }>();
const emit = defineEmits<{ changed: [] }>();

type SortKey = 'name' | 'domain' | 'expires' | 'size';
const query = ref('');
const onlySent = ref(false);
const sortKey = ref<SortKey>('name');
const selected = ref(new Set<string>());
const editing = ref<{ cookie?: SiteCookie } | null>(null);
const importing = ref(false);
const importText = ref('');

const all = computed(() => props.data?.cookies ?? []);

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = all.value.filter(
    (c) =>
      (!onlySent.value || c.sentToPage) &&
      (!q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q) || c.domain.includes(q)),
  );
  const by: Record<SortKey, (a: SiteCookie, b: SiteCookie) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    domain: (a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
    expires: (a, b) => (a.expirationDate ?? Infinity) - (b.expirationDate ?? Infinity),
    size: (a, b) => cookieSize(b) - cookieSize(a),
  };
  return list.sort(by[sortKey.value]);
});

const totalSize = computed(() => visible.value.reduce((n, c) => n + cookieSize(c), 0));
const selectedCookies = computed(() => visible.value.filter((c) => selected.value.has(c.key)));
const allSelected = computed(() => visible.value.length > 0 && selectedCookies.value.length === visible.value.length);

// Drop selections that no longer exist after a reload.
watch(all, (list) => {
  const keys = new Set(list.map((c) => c.key));
  selected.value = new Set([...selected.value].filter((k) => keys.has(k)));
});

function toggle(key: string) {
  const next = new Set(selected.value);
  if (!next.delete(key)) next.add(key);
  selected.value = next;
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(visible.value.map((c) => c.key));
}

async function deleteOne(c: SiteCookie) {
  try {
    await removeCookie(c);
    toast(t('cookieDeleted', c.name));
    emit('changed');
  } catch (err) {
    toastError(err);
  }
}

async function deleteMany(list: SiteCookie[]) {
  if (!list.length) return;
  const ok = await confirm({
    title: t('deleteCookiesTitle', [list.length]),
    message: t('deleteCookiesMessage'),
    confirmText: t('delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await removeCookies(list);
    toast(t('cookiesDeleted', [list.length]));
    selected.value = new Set();
    emit('changed');
  } catch (err) {
    toastError(err);
  }
}

function buildExport() {
  const list = selectedCookies.value.length ? selectedCookies.value : visible.value;
  const file = exportCookies(list, props.target.url);
  return { filename: `cookies-${props.target.host}.json`, text: JSON.stringify(file, null, 2) };
}

function copyHeader() {
  const list = selectedCookies.value.length ? selectedCookies.value : visible.value.filter((c) => c.sentToPage);
  copyText(toCookieHeader(list), t('copied'));
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) importText.value = await file.text();
}

async function runImport() {
  try {
    const drafts = parseImport(importText.value);
    const result = await importCookies(drafts, props.data?.storeId);
    if (result.failed.length) {
      toast(
        t('importPartial', [result.ok, result.failed.length]) +
          '\n' +
          result.failed.map((f) => `${f.name}: ${f.error}`).join('\n'),
        'error',
      );
    } else {
      toast(t('importDone', [result.ok]));
    }
    importing.value = false;
    importText.value = '';
    emit('changed');
  } catch (err) {
    toastError(err);
  }
}

function expiresLabel(c: SiteCookie): string {
  return c.session || c.expirationDate === undefined ? t('session') : formatRelative(c.expirationDate * 1000);
}

function sameSiteLabel(c: SiteCookie): string | null {
  return { no_restriction: 'None', lax: 'Lax', strict: 'Strict', unspecified: null }[c.sameSite] ?? null;
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <input v-model="query" class="search" type="search" :placeholder="t('searchCookies')" data-testid="cookie-search" />
      <select v-model="sortKey" :title="t('sortBy')">
        <option value="name">{{ t('sortName') }}</option>
        <option value="domain">{{ t('sortDomain') }}</option>
        <option value="expires">{{ t('sortExpires') }}</option>
        <option value="size">{{ t('sortSize') }}</option>
      </select>
      <button type="button" class="btn btn-primary" data-testid="cookie-add" @click="editing = {}">
        + {{ t('add') }}
      </button>
    </div>
    <div class="toolbar secondary">
      <label class="check small">
        <input v-model="onlySent" type="checkbox" />
        <span>{{ t('onlySentToPage') }}</span>
      </label>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="copyHeader">{{ t('copyHeader') }}</button>
      <ExportMenu :build="buildExport" />
      <button type="button" class="btn btn-ghost" @click="importing = true">{{ t('import') }}</button>
    </div>

    <div class="list-head">
      <label class="check small">
        <input type="checkbox" :checked="allSelected" :disabled="!visible.length" @change="toggleAll" />
        <span>{{ t('cookieCount', [visible.length, formatBytes(totalSize)]) }}</span>
      </label>
      <span class="spacer" />
      <button
        v-if="selectedCookies.length"
        type="button"
        class="btn btn-danger-ghost"
        @click="deleteMany(selectedCookies)"
      >
        {{ t('deleteSelected', [selectedCookies.length]) }}
      </button>
      <button
        v-else
        type="button"
        class="btn btn-danger-ghost"
        :disabled="!visible.length"
        data-testid="cookie-delete-all"
        @click="deleteMany(visible)"
      >
        {{ t('deleteAll') }}
      </button>
    </div>

    <p v-if="!loading && !visible.length" class="empty">{{ all.length ? t('noMatches') : t('noCookies') }}</p>
    <ul class="rows" data-testid="cookie-list">
      <li
        v-for="c in visible"
        :key="c.key"
        class="row"
        :class="{ selected: selected.has(c.key), dim: !c.sentToPage }"
        :data-name="c.name"
        @click="editing = { cookie: c }"
      >
        <input type="checkbox" :checked="selected.has(c.key)" @click.stop @change="toggle(c.key)" />
        <div class="row-main">
          <div class="row-title">
            <span class="name mono">{{ c.name }}</span>
            <span class="value mono" :title="c.value">{{ c.value }}</span>
          </div>
          <div class="row-meta">
            <span class="mono">{{ c.domain }}{{ c.path }}</span>
            <span :title="c.expirationDate ? formatDateTime(c.expirationDate * 1000) : ''">{{ expiresLabel(c) }}</span>
            <span>{{ formatBytes(cookieSize(c)) }}</span>
            <span v-if="c.httpOnly" class="badge">HttpOnly</span>
            <span v-if="c.secure" class="badge">Secure</span>
            <span v-if="sameSiteLabel(c)" class="badge">SameSite={{ sameSiteLabel(c) }}</span>
            <span v-if="c.partitionKey?.topLevelSite" class="badge badge-accent" :title="c.partitionKey.topLevelSite">
              {{ t('partitionedShort') }}
            </span>
            <span v-if="!c.sentToPage" class="badge badge-muted" :title="t('notSentHint')">{{ t('notSent') }}</span>
          </div>
        </div>
        <div class="row-actions">
          <button type="button" class="icon-btn" :title="t('copyValue')" @click.stop="copyText(c.value, t('copied'))">
            <Icon name="copy" />
          </button>
          <button type="button" class="icon-btn danger" :title="t('delete')" @click.stop="deleteOne(c)"><Icon name="trash" /></button>
        </div>
      </li>
    </ul>

    <CookieEditor
      v-if="editing"
      :cookie="editing.cookie"
      :host="target.host"
      :secure-default="target.protocol === 'https:'"
      :page-partition-site="data?.pagePartitionSite ?? ''"
      :store-id="data?.storeId"
      @close="editing = null"
      @saved="
        editing = null;
        emit('changed');
      "
    />

    <Modal v-if="importing" :title="t('importCookies')" @close="importing = false">
      <p class="muted">{{ t('importHint') }}</p>
      <input type="file" accept="application/json,.json" @change="onImportFile" />
      <textarea v-model="importText" class="mono" rows="10" spellcheck="false" placeholder="[ { &quot;name&quot;: … } ]" />
      <template #footer>
        <button type="button" class="btn" @click="importing = false">{{ t('cancel') }}</button>
        <button type="button" class="btn btn-primary" :disabled="!importText.trim()" @click="runImport">
          {{ t('import') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
