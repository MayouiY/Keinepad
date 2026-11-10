import { ref, shallowRef, watch, type WatchSource } from 'vue';

/**
 * Data of a tab panel that is expensive to fetch from the page. It is fetched when one of the
 * `sources` changes, but only while the panel is `active`: a hidden panel drops what it had and
 * catches up when it is shown again. Until then the tab badge comes from the cheap page
 * overview, so opening the popup does not pay for tabs nobody looks at.
 */
export function usePanelData<T>(options: {
  active: () => boolean;
  /** What the data depends on (tab, URL, refresh counter…). */
  sources: WatchSource[];
  fetch: () => Promise<T>;
  /** Called after every finished fetch with the new data, or null when it failed. */
  settled?: (data: T | null) => void;
}) {
  const data = shallowRef<T | null>(null);
  const error = ref('');
  const loading = ref(false);
  let stale = true;
  let latest = 0;

  async function load(): Promise<void> {
    const request = ++latest;
    stale = false;
    loading.value = true;
    let result: T | null = null;
    let message = '';
    try {
      result = await options.fetch();
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    // A newer request (or a change while hidden) has taken over.
    if (request !== latest) return;
    data.value = result;
    error.value = message;
    loading.value = false;
    options.settled?.(result);
  }

  watch(options.sources, () => {
    if (options.active()) {
      load();
      return;
    }
    latest++;
    stale = true;
    data.value = null;
    error.value = '';
    loading.value = false;
  });
  watch(
    options.active,
    (active) => {
      if (active && stale) load();
    },
    { immediate: true },
  );

  return { data, error, loading, load };
}
