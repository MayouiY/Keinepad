<script setup lang="ts">
import { t } from '../../utils/i18n';
import { confirmState, settleConfirm, toasts } from '../composables/feedback';
import Modal from './Modal.vue';
</script>

<template>
  <Modal v-if="confirmState.open" :title="confirmState.options.title" @close="settleConfirm(false)">
    <p v-if="confirmState.options.message" class="confirm-message">{{ confirmState.options.message }}</p>
    <template #footer>
      <button type="button" class="btn" @click="settleConfirm(false)">{{ t('cancel') }}</button>
      <button
        type="button"
        class="btn"
        :class="confirmState.options.danger ? 'btn-danger' : 'btn-primary'"
        data-testid="confirm-ok"
        @click="settleConfirm(true)"
      >
        {{ confirmState.options.confirmText || t('confirm') }}
      </button>
    </template>
  </Modal>
  <div class="toasts" aria-live="polite">
    <div v-for="item in toasts" :key="item.id" class="toast" :class="`toast-${item.kind}`">{{ item.text }}</div>
  </div>
</template>
