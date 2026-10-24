<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../../utils/i18n';
import { copyText, downloadText, toast } from '../composables/feedback';
import Icon from './Icon.vue';

// Export button with a second-level choice: copy the payload to the clipboard or save it as a file.
const props = defineProps<{ build: () => { filename: string; text: string }; disabled?: boolean }>();

const open = ref(false);
const alignRight = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
  // Open towards whichever side has room; the toolbar wraps in narrow side panels.
  const rect = root.value?.getBoundingClientRect();
  alignRight.value = !!rect && rect.left + rect.width / 2 > document.documentElement.clientWidth / 2;
  open.value = !open.value;
}

function onDocMouseDown(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

function listen(on: boolean) {
  if (on) {
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
  } else {
    document.removeEventListener('mousedown', onDocMouseDown);
    document.removeEventListener('keydown', onKey);
  }
}
watch(open, listen);
onBeforeUnmount(() => listen(false));

function toClipboard() {
  open.value = false;
  copyText(props.build().text, t('copied'));
}

function toFile() {
  open.value = false;
  const { filename, text } = props.build();
  downloadText(filename, text);
  toast(t('exportedFile', filename));
}
</script>

<template>
  <div ref="root" class="menu-wrap">
    <button
      type="button"
      class="btn btn-ghost menu-trigger"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="open"
      data-testid="export"
      @click="toggle"
    >
      {{ t('export') }}
      <Icon name="chevronDown" :size="12" />
    </button>
    <div v-if="open" class="menu" :class="{ right: alignRight }" role="menu">
      <button type="button" class="menu-item" role="menuitem" data-testid="export-clipboard" @click="toClipboard">
        <Icon name="copy" :size="14" />
        {{ t('exportToClipboard') }}
      </button>
      <button type="button" class="menu-item" role="menuitem" data-testid="export-file" @click="toFile">
        <Icon name="download" :size="14" />
        {{ t('exportToFile') }}
      </button>
    </div>
  </div>
</template>
