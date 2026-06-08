import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Transport } from "viem";
import {
  createSemaphore,
  withCooldown,
  withConcurrencyLimit,
} from "../../../src/utils/rpc-pool.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RequestFn = (args: {
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

/** Minimal viem Transport stub. */
function mkTransport(requestFn: RequestFn): Transport {
  return () =>
    ({
      config: { key: "mock", name: "mock", request: requestFn, type: "mock" },
      request: requestFn,
      value: undefined,
    }) as ReturnType<Transport>;
}

/** Deferred promise: resolve/reject from outside. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// createSemaphore
// ---------------------------------------------------------------------------

describe("createSemaphore", () => {
  it("runs single task immediately", async () => {
    const limit = createSemaphore(2);
    const result = await limit(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("never exceeds max concurrent executions", async () => {
    const max = 3;
    const total = 8;
    const limit = createSemaphore(max);

    let inflight = 0;
    let maxSeen = 0;
    const defs = Array.from({ length: total }, () => deferred<void>());

    const tasks = defs.map((d) =>
      limit(() => {
        inflight++;
        if (inflight > maxSeen) maxSeen = inflight;
        return d.promise.finally(() => {
          inflight--;
        });
      }),
    );

    // Resolve them all
    defs.forEach((d) => d.resolve());
    await Promise.all(tasks);

    expect(maxSeen).toBeLessThanOrEqual(max);
  });

  it("all tasks complete even if queued", async () => {
    const limit = createSemaphore(2);
    const results: number[] = [];
    const tasks = [1, 2, 3, 4, 5].map((n) =>
      limit(async () => {
        results.push(n);
        return n;
      }),
    );
    const resolved = await Promise.all(tasks);
    expect(resolved).toEqual([1, 2, 3, 4, 5]);
    expect(results).toHaveLength(5);
  });

  it("propagates rejection without blocking other tasks", async () => {
    const limit = createSemaphore(1);
    const d1 = deferred<string>();
    const d2 = deferred<string>();

    const p1 = limit(() => d1.promise);
    const p2 = limit(() => d2.promise);

    d1.reject(new Error("boom"));
    d2.resolve("ok");

    await expect(p1).rejects.toThrow("boom");
    await expect(p2).resolves.toBe("ok");
  });

  it("counts: exactly max tasks start before any resolves", async () => {
    const max = 2;
    const limit = createSemaphore(max);

    const started: number[] = [];
    const defs = [deferred<void>(), deferred<void>(), deferred<void>()];

    // kick off 3 tasks but hold them
    const tasks = defs.map((d, i) =>
      limit(() => {
        started.push(i);
        return d.promise;
      }),
    );

    // microtask flush — tasks[0] and tasks[1] should have started; tasks[2] queued
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([0, 1]);

    // resolve task[0] → task[2] starts
    defs[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toContain(2);

    defs[1].resolve();
    defs[2].resolve();
    await Promise.all(tasks);
  });
});

// ---------------------------------------------------------------------------
// withCooldown
// ---------------------------------------------------------------------------

describe("withCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes through when no error", async () => {
    const inner = vi.fn().mockResolvedValue("data");
    const t = withCooldown(mkTransport(inner), 5_000);
    const client = t({ chain: undefined, pollingInterval: 4_000 });
    const result = await client.request({ method: "eth_blockNumber" });
    expect(result).toBe("data");
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("activates cooldown on 429 — next call throws without hitting inner", async () => {
    const err429 = Object.assign(new Error("rate limit"), { status: 429 });
    const inner = vi.fn().mockRejectedValueOnce(err429).mockResolvedValue("ok");
    const t = withCooldown(mkTransport(inner), 10_000);
    const client = t({ chain: undefined, pollingInterval: 4_000 });

    // first call — should throw 429 and start cooldown
    await expect(client.request({ method: "eth_call" })).rejects.toThrow(
      "rate limit",
    );

    // second call within cooldown — must NOT call inner
    await expect(client.request({ method: "eth_call" })).rejects.toThrow(
      "provider in cooldown",
    );
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("allows calls again after cooldown expires", async () => {
    const err429 = Object.assign(new Error("rate limit"), { status: 429 });
    const inner = vi.fn().mockRejectedValueOnce(err429).mockResolvedValue("ok");
    const t = withCooldown(mkTransport(inner), 10_000);
    const client = t({ chain: undefined, pollingInterval: 4_000 });

    await expect(client.request({ method: "eth_call" })).rejects.toThrow();

    vi.advanceTimersByTime(10_000);

    const result = await client.request({ method: "eth_call" });
    expect(result).toBe("ok");
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("does NOT activate cooldown on non-429 error", async () => {
    const boom = new Error("boom");
    const inner = vi.fn().mockRejectedValueOnce(boom).mockResolvedValue("ok");
    const t = withCooldown(mkTransport(inner), 10_000);
    const client = t({ chain: undefined, pollingInterval: 4_000 });

    await expect(client.request({ method: "eth_call" })).rejects.toThrow(
      "boom",
    );

    // next call must reach inner (no cooldown)
    const result = await client.request({ method: "eth_call" });
    expect(result).toBe("ok");
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("detects 429 via cause chain", async () => {
    const cause = Object.assign(new Error("http"), { status: 429 });
    const wrapped = Object.assign(new Error("wrapper"), { cause });
    const inner = vi
      .fn()
      .mockRejectedValueOnce(wrapped)
      .mockResolvedValue("ok");
    const t = withCooldown(mkTransport(inner), 5_000);
    const client = t({ chain: undefined, pollingInterval: 4_000 });

    await expect(client.request({ method: "eth_call" })).rejects.toThrow(
      "wrapper",
    );

    // should be in cooldown now
    await expect(client.request({ method: "eth_call" })).rejects.toThrow(
      "provider in cooldown",
    );
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("each transport instance has independent cooldown state", async () => {
    const err429 = Object.assign(new Error("rate limit"), { status: 429 });
    const inner1 = vi
      .fn()
      .mockRejectedValueOnce(err429)
      .mockResolvedValue("ok");
    const inner2 = vi.fn().mockResolvedValue("ok");

    const t1 = withCooldown(mkTransport(inner1), 10_000);
    const t2 = withCooldown(mkTransport(inner2), 10_000);

    const client1 = t1({ chain: undefined, pollingInterval: 4_000 });
    const client2 = t2({ chain: undefined, pollingInterval: 4_000 });

    // Trigger 429 on client1 — goes through the wrapper, sets its cooldownUntil
    await expect(client1.request({ method: "eth_call" })).rejects.toThrow(
      "rate limit",
    );
    // client2 has its own closure — must NOT be in cooldown
    const result = await client2.request({ method: "eth_call" });
    expect(result).toBe("ok");
    expect(inner2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// withConcurrencyLimit
// ---------------------------------------------------------------------------

describe("withConcurrencyLimit", () => {
  it("passes through on success", async () => {
    const inner = vi.fn().mockResolvedValue(99n);
    const t = withConcurrencyLimit(mkTransport(inner), 3);
    const client = t({ chain: undefined, pollingInterval: 4_000 });
    const result = await client.request({ method: "eth_getBalance" });
    expect(result).toBe(99n);
  });

  it("limits concurrent inner.request calls to maxConcurrency", async () => {
    const maxConcurrency = 2;
    const total = 6;

    const defs = Array.from({ length: total }, () => deferred<string>());
    let inflight = 0;
    let maxSeen = 0;
    let callIndex = 0;

    const inner = vi.fn().mockImplementation(() => {
      const idx = callIndex++;
      inflight++;
      if (inflight > maxSeen) maxSeen = inflight;
      return defs[idx].promise.finally(() => {
        inflight--;
      });
    });

    const t = withConcurrencyLimit(mkTransport(inner), maxConcurrency);
    const client = t({ chain: undefined, pollingInterval: 4_000 });

    const tasks = defs.map(() => client.request({ method: "eth_call" }));

    defs.forEach((d) => d.resolve("x"));
    await Promise.all(tasks);

    expect(maxSeen).toBeLessThanOrEqual(maxConcurrency);
    expect(inner).toHaveBeenCalledTimes(total);
  });

  it("semaphore is shared across multiple client instances from same transport", async () => {
    const maxConcurrency = 2;
    const defs = Array.from({ length: 4 }, () => deferred<string>());
    let inflight = 0;
    let maxSeen = 0;
    let idx = 0;

    const inner = vi.fn().mockImplementation(() => {
      const i = idx++;
      inflight++;
      if (inflight > maxSeen) maxSeen = inflight;
      return defs[i].promise.finally(() => {
        inflight--;
      });
    });

    const base = mkTransport(inner);
    const t = withConcurrencyLimit(base, maxConcurrency);

    // Two separate client instances from the SAME wrapped transport
    const c1 = t({ chain: undefined, pollingInterval: 4_000 });
    const c2 = t({ chain: undefined, pollingInterval: 4_000 });

    const tasks = [
      c1.request({ method: "eth_call" }),
      c1.request({ method: "eth_call" }),
      c2.request({ method: "eth_call" }),
      c2.request({ method: "eth_call" }),
    ];

    defs.forEach((d) => d.resolve("x"));
    await Promise.all(tasks);

    expect(maxSeen).toBeLessThanOrEqual(maxConcurrency);
  });

  it("propagates errors from inner", async () => {
    const inner = vi.fn().mockRejectedValue(new Error("rpc down"));
    const t = withConcurrencyLimit(mkTransport(inner), 2);
    const client = t({ chain: undefined, pollingInterval: 4_000 });
    await expect(client.request({ method: "eth_call" })).rejects.toThrow(
      "rpc down",
    );
  });
});
