<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { applyEncoding, encodingGroupLabel, getEncodingOverride } from '../../services/encoding';
import type { TargetTab } from '../../services/tab';
import { encodingLabel, findEncoding, groupEncodings } from '../../utils/encoding';
import { t } from '../../utils/i18n';
import { toast, toastError } from '../composables/feedback';

// Header dropdown that re-decodes the page with another character encoding.
// `detected` is the encoding the page is currently decoded with (see inspectPage).
const props = defineProps<{ target: TargetTab; refreshToken: number; detected?: string }>();

const AUTO = '';
const groups = groupEncodings().map(([group, list]) => ({ label: encodingGroupLabel(group), list }));
const selected = ref(AUTO);
const busy = ref(false);

const detectedLabel = computed(() => {
  const enc = findEncoding(props.detected);
  return enc ? encodingLabel(enc) : props.detected;
});

async function load() {
  const { tabId, host } = props.target;
  const override = await getEncodingOverride(tabId, host).catch(() => undefined);
  // The side panel may have switched to another tab while the rules were being read.
  if (props.target.tabId === tabId && props.target.host === host) selected.value = override?.name ?? AUTO;
}

watch([() => props.target.tabId, () => props.target.url, () => props.refreshToken], load, { immediate: true });

async function onChange() {
  const { tabId, host } = props.target;
  const encoding = selected.value || undefined;
  busy.value = true;
  try {
    await applyEncoding(tabId, host, encoding);
    toast(encoding ? t('encodingApplied', encodingLabel(findEncoding(encoding)!)) : t('encodingReset'));
  } catch (err) {
    toastError(err);
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <select
    v-model="selected"
    class="encoding-select"
    :class="{ overridden: selected !== AUTO }"
    :title="t('encodingHint')"
    :aria-label="t('encodingMenu')"
    :disabled="busy"
    data-testid="encoding-select"
    @change="onChange"
  >
    <option :value="AUTO">{{ detectedLabel ? t('encodingAutoDetected', detectedLabel) : t('encodingAuto') }}</option>
    <optgroup v-for="g in groups" :key="g.label" :label="g.label">
      <option v-for="enc in g.list" :key="enc.name" :value="enc.name">{{ encodingLabel(enc) }}</option>
    </optgroup>
  </select>
</template>
