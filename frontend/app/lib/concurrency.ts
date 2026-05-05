// Maximum number of photo uploads dispatched in parallel from a single batch.
// Tuned conservatively so a user uploading dozens of photos does not exhaust
// the browser's per-origin connection budget or the backend's request pool.
export const PHOTO_UPLOAD_CONCURRENCY = 3;

export type SettledResult<R> =
  | { ok: true; value: R }
  | { ok: false; error: unknown };

export interface ConcurrencyHooks<T> {
  onStart?: (item: T, index: number) => void;
  onSettle?: (
    item: T,
    index: number,
    result: { ok: true } | { ok: false },
  ) => void;
}

export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  hooks: ConcurrencyHooks<T> = {},
): Promise<SettledResult<R>[]> {
  if (limit < 1) {
    throw new RangeError("runWithConcurrency: limit must be >= 1");
  }

  const results: SettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function pump(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      const item = items[index]!;
      hooks.onStart?.(item, index);
      try {
        const value = await worker(item, index);
        results[index] = { ok: true, value };
        hooks.onSettle?.(item, index, { ok: true });
      } catch (error) {
        results[index] = { ok: false, error };
        hooks.onSettle?.(item, index, { ok: false });
      }
    }
  }

  const poolSize = Math.min(limit, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < poolSize; i += 1) {
    workers.push(pump());
  }
  await Promise.all(workers);
  return results;
}

export interface BatchProgressSnapshot {
  total: number;
  completed: number;
  currentFileName: string | null;
}

// Tracks an in-flight stack so the displayed file name follows the most
// recently started worker. The completed counter only increments and the
// snapshot reverts to `null` once every worker has settled.
export function createUploadBatchTracker(
  files: readonly File[],
  emit: (snapshot: BatchProgressSnapshot) => void,
): { hooks: ConcurrencyHooks<File> } {
  const total = files.length;
  const inFlight: File[] = [];
  let completed = 0;

  function snapshot(): BatchProgressSnapshot {
    const top = inFlight[inFlight.length - 1];
    return {
      total,
      completed,
      currentFileName: top ? top.name : null,
    };
  }

  return {
    hooks: {
      onStart(file) {
        inFlight.push(file);
        emit(snapshot());
      },
      onSettle(file) {
        completed += 1;
        const index = inFlight.indexOf(file);
        if (index !== -1) {
          inFlight.splice(index, 1);
        }
        emit(snapshot());
      },
    },
  };
}
