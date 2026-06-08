import type { Transport } from "viem";

// ---------------------------------------------------------------------------
// createSemaphore
// ---------------------------------------------------------------------------

export function createSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const run = queue.shift()!;
    run();
  };

  return function acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

// ---------------------------------------------------------------------------
// withCooldown
// ---------------------------------------------------------------------------

function is429(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    if (
      typeof cur === "object" &&
      cur !== null &&
      (cur as { status?: number }).status === 429
    )
      return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

export function withCooldown(
  transport: Transport,
  cooldownMs: number,
): Transport {
  return (config) => {
    const inner = transport(config);
    let cooldownUntil = 0;

    const request = (async (args) => {
      if (Date.now() < cooldownUntil) throw new Error("provider in cooldown");
      try {
        return await inner.request(args);
      } catch (err) {
        if (is429(err)) cooldownUntil = Date.now() + cooldownMs;
        throw err;
      }
    }) as typeof inner.request;

    return { ...inner, request };
  };
}

// ---------------------------------------------------------------------------
// withConcurrencyLimit
// ---------------------------------------------------------------------------

export function withConcurrencyLimit(
  transport: Transport,
  maxConcurrency: number,
): Transport {
  const limit = createSemaphore(maxConcurrency);

  return (config) => {
    const inner = transport(config);

    const request = ((args) =>
      limit(() => inner.request(args))) as typeof inner.request;

    return { ...inner, request };
  };
}
