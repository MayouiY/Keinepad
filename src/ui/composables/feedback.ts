import { reactive, ref } from 'vue';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

export const toasts = ref<ToastItem[]>([]);
let nextToastId = 1;

export function toast(text: string, kind: ToastKind = 'success'): void {
  const id = nextToastId++;
  toasts.value.push({ id, text, kind });
  setTimeout(
    () => {
      toasts.value = toasts.value.filter((x) => x.id !== id);
    },
    kind === 'error' ? 5000 : 2400,
  );
}

export function toastError(err: unknown): void {
  toast(err instanceof Error ? err.message : String(err), 'error');
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

export const confirmState = reactive<{
  open: boolean;
  options: ConfirmOptions;
  resolve: ((ok: boolean) => void) | null;
}>({ open: false, options: { title: '' }, resolve: null });

export function confirm(options: ConfirmOptions): Promise<boolean> {
  confirmState.resolve?.(false);
  return new Promise((resolve) => {
    confirmState.options = options;
    confirmState.resolve = resolve;
    confirmState.open = true;
  });
}

export function settleConfirm(ok: boolean): void {
  confirmState.resolve?.(ok);
  confirmState.resolve = null;
  confirmState.open = false;
}

export async function copyText(text: string, okMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch (err) {
    toastError(err);
  }
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
