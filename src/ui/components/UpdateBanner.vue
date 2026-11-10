<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue';
import {
  checkForUpdate,
  currentVersion,
  dismissUpdate,
  isUnpacked,
  pendingUpdate,
  selfUpdateEnabled,
  type ReleaseInfo,
} from '../../services/update';
import { formatDateTime, t } from '../../utils/i18n';
import Icon from './Icon.vue';
import Modal from './Modal.vue';

/** `ready`: the view has shown its data, so the update check no longer competes with it. */
const props = defineProps<{ ready: boolean }>();

const release = shallowRef<ReleaseInfo>();
const showNotes = ref(false);
const unpacked = ref(false);

async function refresh(check: boolean) {
  try {
    if (check) await checkForUpdate();
    release.value = await pendingUpdate();
  } catch (err) {
    console.warn('Update check failed', err);
  }
}

// Store builds are updated by the browser, so there is nothing to look up for them.
if (selfUpdateEnabled()) {
  // What the last check found is shown right away; looking for something newer can wait.
  onMounted(() => refresh(false));
  watch(
    () => props.ready,
    (ready) => {
      if (ready) refresh(true);
    },
    { immediate: true },
  );
}

async function openNotes() {
  // Only the notes dialog offers "reload extension", so the install type is looked up here.
  unpacked.value = await isUnpacked();
  showNotes.value = true;
}

function open(url: string) {
  chrome.tabs.create({ url });
}

function reload() {
  chrome.runtime.reload();
}

async function skip() {
  if (!release.value) return;
  await dismissUpdate(release.value.version);
  release.value = undefined;
  showNotes.value = false;
}
</script>

<template>
  <div v-if="release" class="update-banner" data-testid="update-banner">
    <span class="update-text" :title="t('updateCurrent', currentVersion())">{{ t('updateAvailable', release.version) }}</span>
    <button type="button" class="btn" @click="openNotes">{{ t('updateNotes') }}</button>
    <button type="button" class="btn btn-primary" @click="open(release.downloadUrl)">
      <Icon name="download" :size="14" />
      {{ t('updateDownload') }}
    </button>
    <button type="button" class="icon-btn" :title="t('updateSkip')" @click="skip">
      <Icon name="close" :size="14" />
    </button>
  </div>

  <Modal v-if="showNotes && release" :title="release.name" wide @close="showNotes = false">
    <p class="muted">
      {{ t('updateCurrent', currentVersion()) }}
      <template v-if="release.publishedAt"> · {{ formatDateTime(Date.parse(release.publishedAt)) }}</template>
    </p>
    <pre class="update-notes">{{ release.notes || t('updateNoNotes') }}</pre>
    <p class="muted">{{ t('updateHowTo') }}</p>
    <template #footer>
      <button type="button" class="btn" @click="skip">{{ t('updateSkip') }}</button>
      <button type="button" class="btn" @click="open(release.pageUrl)">{{ t('updateReleasePage') }}</button>
      <button v-if="unpacked" type="button" class="btn" :title="t('updateReloadHint')" @click="reload">
        {{ t('updateReload') }}
      </button>
      <button type="button" class="btn btn-primary" @click="open(release.downloadUrl)">{{ t('updateDownload') }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.update-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--border);
}
.update-banner .btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.update-text {
  flex: 1;
  min-width: 0;
}
.update-notes {
  max-height: 280px;
  overflow: auto;
  margin: 0 0 10px;
  padding: 8px;
  background: var(--bg-soft);
  border-radius: var(--radius);
  font: 12px/1.5 var(--mono);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
