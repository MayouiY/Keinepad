<script setup lang="ts">
import { computed } from 'vue';
import { tryDecodeJwt, tryJsonPretty, tryUrlDecode } from '../../utils/decode';
import { formatDateTime, t } from '../../utils/i18n';

const props = defineProps<{ value: string }>();

const urlDecoded = computed(() => tryUrlDecode(props.value));
// JSON is often URL-encoded inside cookies, so try the decoded form as well.
const json = computed(() => tryJsonPretty(props.value) ?? (urlDecoded.value ? tryJsonPretty(urlDecoded.value) : null));
const jwt = computed(() => tryDecodeJwt(urlDecoded.value ?? props.value));
const jwtText = computed(() =>
  jwt.value ? JSON.stringify({ header: jwt.value.header, payload: jwt.value.payload }, null, 2) : '',
);
const jwtExpired = computed(() => !!jwt.value?.expiresAt && jwt.value.expiresAt < Date.now());
</script>

<template>
  <div v-if="urlDecoded || json || jwt" class="value-preview">
    <section v-if="jwt">
      <h4>
        {{ t('previewJwt') }}
        <span v-if="jwt.expiresAt" class="badge" :class="jwtExpired ? 'badge-danger' : 'badge-ok'">
          {{ jwtExpired ? t('jwtExpired') : t('jwtExpires') }} {{ formatDateTime(jwt.expiresAt) }}
        </span>
      </h4>
      <pre>{{ jwtText }}</pre>
    </section>
    <section v-else-if="json">
      <h4>{{ t('previewJson') }}</h4>
      <pre>{{ json }}</pre>
    </section>
    <section v-if="urlDecoded && !json && !jwt">
      <h4>{{ t('previewUrlDecoded') }}</h4>
      <pre>{{ urlDecoded }}</pre>
    </section>
  </div>
</template>
