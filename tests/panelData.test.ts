import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { usePanelData } from '../src/ui/composables/panelData';

/** Lets watchers and the promise chains they start run to completion. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('usePanelData', () => {
  it('fetches only while the panel is active and catches up when it is shown again', async () => {
    const active = ref(false);
    const key = ref(1);
    let fetches = 0;
    const reported: (string | null)[] = [];
    const { data, loading } = usePanelData({
      active: () => active.value,
      sources: [key],
      fetch: async () => `key ${key.value}, fetch ${++fetches}`,
      settled: (result) => reported.push(result),
    });

    await settle();
    expect(fetches).toBe(0);
    expect(data.value).toBeNull();

    active.value = true;
    await settle();
    expect(data.value).toBe('key 1, fetch 1');
    expect(loading.value).toBe(false);

    key.value = 2;
    await settle();
    expect(data.value).toBe('key 2, fetch 2');

    // Hidden: a change drops what is shown instead of fetching…
    active.value = false;
    key.value = 3;
    await settle();
    expect(fetches).toBe(2);
    expect(data.value).toBeNull();

    // …and is caught up on when the panel comes back.
    active.value = true;
    await settle();
    expect(data.value).toBe('key 3, fetch 3');

    // Nothing changed while hidden: showing the panel again does not fetch.
    active.value = false;
    await settle();
    active.value = true;
    await settle();
    expect(fetches).toBe(3);
    expect(data.value).toBe('key 3, fetch 3');

    expect(reported).toEqual(['key 1, fetch 1', 'key 2, fetch 2', 'key 3, fetch 3']);
  });

  it('ignores a result that was overtaken by a newer request', async () => {
    const key = ref('a');
    const pending = new Map<string, ReturnType<typeof deferred<string>>>();
    const reported: (string | null)[] = [];
    const { data, loading } = usePanelData({
      active: () => true,
      sources: [key],
      fetch: () => {
        const request = deferred<string>();
        pending.set(key.value, request);
        return request.promise;
      },
      settled: (result) => reported.push(result),
    });
    await settle();
    key.value = 'b';
    await settle();
    expect(loading.value).toBe(true);

    // The newer request finishes first; the older answer arrives late and must not win.
    pending.get('b')!.resolve('data for b');
    await settle();
    pending.get('a')!.resolve('data for a');
    await settle();
    expect(data.value).toBe('data for b');
    expect(loading.value).toBe(false);
    expect(reported).toEqual(['data for b']);
  });

  it('discards a request that is still out when the panel is hidden and its sources change', async () => {
    const active = ref(true);
    const key = ref(1);
    const requests: ReturnType<typeof deferred<string>>[] = [];
    const reported: (string | null)[] = [];
    const { data, loading } = usePanelData({
      active: () => active.value,
      sources: [key],
      fetch: () => {
        const request = deferred<string>();
        requests.push(request);
        return request.promise;
      },
      settled: (result) => reported.push(result),
    });
    await settle();
    active.value = false;
    key.value = 2;
    await settle();
    requests[0].resolve('for the old key');
    await settle();
    expect(data.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(reported).toEqual([]);
  });

  it('reports a failed fetch as an error without data', async () => {
    const key = ref(1);
    const reported: (string | null)[] = [];
    const { data, error, load } = usePanelData<string>({
      active: () => true,
      sources: [key],
      fetch: async () => {
        if (key.value === 1) throw new Error('Cannot access contents of the page');
        return 'ok';
      },
      settled: (result) => reported.push(result),
    });
    await settle();
    expect(data.value).toBeNull();
    expect(error.value).toBe('Cannot access contents of the page');

    key.value = 2;
    await settle();
    expect(data.value).toBe('ok');
    expect(error.value).toBe('');

    // An explicit reload (after an edit) keeps what is shown until the new data is in.
    const reloading = load();
    expect(data.value).toBe('ok');
    await reloading;
    expect(reported).toEqual([null, 'ok', 'ok']);
  });
});
