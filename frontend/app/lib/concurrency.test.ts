import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_UPLOAD_CONCURRENCY,
  runWithConcurrency,
} from "~/lib/concurrency";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("runWithConcurrency", () => {
  it("exposes a sensible default photo upload limit", () => {
    expect(PHOTO_UPLOAD_CONCURRENCY).toBeGreaterThanOrEqual(2);
    expect(PHOTO_UPLOAD_CONCURRENCY).toBeLessThanOrEqual(6);
  });

  it("never dispatches more than `limit` workers concurrently", async () => {
    const items = Array.from({ length: 7 }, (_, index) => index);
    const deferreds = items.map(() => createDeferred<number>());

    let inFlight = 0;
    let observedMax = 0;

    const promise = runWithConcurrency(items, 3, async (item) => {
      inFlight += 1;
      observedMax = Math.max(observedMax, inFlight);
      try {
        return await deferreds[item]!.promise;
      } finally {
        inFlight -= 1;
      }
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight).toBe(3);

    deferreds[0]!.resolve(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight).toBe(3);

    for (const deferred of deferreds) {
      deferred.resolve(0);
    }

    const results = await promise;
    expect(results).toHaveLength(items.length);
    expect(observedMax).toBe(3);
  });

  it("returns results in input order regardless of completion order", async () => {
    const items = ["a", "b", "c", "d"];
    const delays: Record<string, number> = { a: 30, b: 5, c: 20, d: 1 };

    const results = await runWithConcurrency(items, 2, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, delays[item]));
      return item.toUpperCase();
    });

    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("collects per-item failures without aborting the batch", async () => {
    const items = [1, 2, 3, 4];
    const failure = new Error("boom");

    const results = await runWithConcurrency(items, 2, async (item) => {
      if (item === 2) {
        throw failure;
      }
      return item * 10;
    });

    expect(results).toEqual([
      { ok: true, value: 10 },
      { ok: false, error: failure },
      { ok: true, value: 30 },
      { ok: true, value: 40 },
    ]);
  });

  it("invokes onStart and onSettle hooks for every item", async () => {
    const items = ["x", "y"];
    const onStart = vi.fn();
    const onSettle = vi.fn();

    await runWithConcurrency(
      items,
      2,
      async (item) => {
        if (item === "y") {
          throw new Error("nope");
        }
        return item;
      },
      { onStart, onSettle },
    );

    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenNthCalledWith(1, "x", 0);
    expect(onStart).toHaveBeenNthCalledWith(2, "y", 1);

    expect(onSettle).toHaveBeenCalledTimes(2);
    expect(onSettle).toHaveBeenCalledWith("x", 0, { ok: true });
    expect(onSettle).toHaveBeenCalledWith("y", 1, { ok: false });
  });

  it("returns an empty array when items are empty without spawning workers", async () => {
    const worker = vi.fn();
    const results = await runWithConcurrency([], 4, worker);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("throws when the limit is below 1", async () => {
    await expect(
      runWithConcurrency([1], 0, async (n) => n),
    ).rejects.toBeInstanceOf(RangeError);
  });
});
