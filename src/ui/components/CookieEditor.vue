<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { saveCookie, type SiteCookie } from '../../services/cookies';
import { emptyDraft, toDraft, validateDraft, type CookieDraft } from '../../utils/cookie';
import { formatBytes, byteSize } from '../../utils/decode';
import { formatRelative, t } from '../../utils/i18n';
import { toast, toastError } from '../composables/feedback';
import Modal from './Modal.vue';
import ValuePreview from './ValuePreview.vue';

const props = defineProps<{
  cookie?: SiteCookie;
  host: string;
  secureDefault: boolean;
  pagePartitionSite: string;
  storeId?: string;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();

const draft = reactive<CookieDraft>(props.cookie ? toDraft(props.cookie) : emptyDraft(props.host, props.secureDefault));
const saving = ref(false);
const submitted = ref(false);

const errors = computed(() => validateDraft(draft));
const size = computed(() => byteSize(draft.name + draft.value));

function toLocalInput(seconds: number | undefined): string {
  if (seconds === undefined) return '';
  const d = new Date(seconds * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

const expiresInput = computed({
  get: () => toLocalInput(draft.expirationDate),
  set: (v: string) => {
    const ms = new Date(v).getTime();
    draft.expirationDate = Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
  },
});

const presets: [string, number][] = [
  ['1h', 3600],
  ['1d', 86400],
  ['7d', 7 * 86400],
  ['30d', 30 * 86400],
  ['1y', 365 * 86400],
];

function applyPreset(seconds: number) {
  draft.session = false;
  draft.expirationDate = Math.floor(Date.now() / 1000) + seconds;
}

const partitioned = computed({
  get: () => !!draft.partitionTopLevelSite,
  set: (on: boolean) => {
    draft.partitionTopLevelSite = on ? props.pagePartitionSite : undefined;
    if (on) draft.secure = true;
  },
});

async function save() {
  submitted.value = true;
  if (errors.value.length) return;
  saving.value = true;
  try {
    await saveCookie({ ...draft, domain: draft.domain.trim() }, props.cookie, props.storeId);
    toast(t('cookieSaved'));
    emit('saved');
  } catch (err) {
    toastError(err);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal :title="cookie ? t('editCookie') : t('addCookie')" wide @close="emit('close')">
    <form class="form" data-testid="cookie-editor" @submit.prevent="save">
      <label class="field">
        <span>{{ t('colName') }}</span>
        <input v-model="draft.name" class="mono" name="name" spellcheck="false" autocomplete="off" />
      </label>
      <label class="field">
        <span>
          {{ t('colValue') }}
          <small class="muted">{{ formatBytes(size) }}</small>
        </span>
        <textarea v-model="draft.value" class="mono" name="value" rows="4" spellcheck="false" />
      </label>
      <ValuePreview :value="draft.value" />

      <div class="field-row">
        <label class="field grow">
          <span>{{ t('colDomain') }}</span>
          <input v-model="draft.domain" class="mono" name="domain" spellcheck="false" />
        </label>
        <label class="field">
          <span>{{ t('colPath') }}</span>
          <input v-model="draft.path" class="mono" name="path" spellcheck="false" />
        </label>
      </div>
      <label class="check">
        <input v-model="draft.hostOnly" type="checkbox" name="hostOnly" />
        <span>{{ t('hostOnly') }}</span>
        <small class="muted">{{ t('hostOnlyHint') }}</small>
      </label>

      <div class="field">
        <span>{{ t('colExpires') }}</span>
        <div class="expires-row">
          <label class="check">
            <input v-model="draft.session" type="checkbox" name="session" />
            <span>{{ t('sessionCookie') }}</span>
          </label>
          <template v-if="!draft.session">
            <input v-model="expiresInput" type="datetime-local" step="1" name="expires" />
            <small v-if="draft.expirationDate" class="muted">{{ formatRelative(draft.expirationDate * 1000) }}</small>
          </template>
        </div>
        <div class="chip-row">
          <button v-for="[label, secs] in presets" :key="label" type="button" class="chip" @click="applyPreset(secs)">
            +{{ label }}
          </button>
        </div>
      </div>

      <div class="field-row flags">
        <label class="check">
          <input v-model="draft.secure" type="checkbox" name="secure" />
          <span>Secure</span>
        </label>
        <label class="check">
          <input v-model="draft.httpOnly" type="checkbox" name="httpOnly" />
          <span>HttpOnly</span>
        </label>
        <label class="field inline">
          <span>SameSite</span>
          <select v-model="draft.sameSite" name="sameSite">
            <option value="unspecified">{{ t('sameSiteUnspecified') }}</option>
            <option value="lax">Lax</option>
            <option value="strict">Strict</option>
            <option value="no_restriction">None</option>
          </select>
        </label>
      </div>

      <label class="check">
        <input v-model="partitioned" type="checkbox" name="partitioned" />
        <span>{{ t('partitioned') }}</span>
        <small class="muted">{{ t('partitionedHint') }}</small>
      </label>
      <label v-if="partitioned" class="field">
        <span>{{ t('partitionTopLevelSite') }}</span>
        <input v-model="draft.partitionTopLevelSite" class="mono" spellcheck="false" />
      </label>

      <ul v-if="submitted && errors.length" class="form-errors" data-testid="cookie-errors">
        <li v-for="e in errors" :key="e">{{ t(e) }}</li>
      </ul>
      <button type="submit" hidden />
    </form>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">{{ t('cancel') }}</button>
      <button type="button" class="btn btn-primary" :disabled="saving" data-testid="cookie-save" @click="save">
        {{ t('save') }}
      </button>
    </template>
  </Modal>
</template>
