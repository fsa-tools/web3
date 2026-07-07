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

const CAUSE_CHAIN_MAX_DEPTH = 5;
const HTTP_TOO_MANY_REQUESTS = 429;
const RATE_LIMIT_TEXT_SIGNALS = [
  String(HTTP_TOO_MANY_REQUESTS),
  "too many requests",
  "rate limit",
];

function hasRateLimitSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return RATE_LIMIT_TEXT_SIGNALS.some((signal) => lower.includes(signal));
}

function is429(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < CAUSE_CHAIN_MAX_DEPTH && cur; i++) {
    if (typeof cur === "object" && cur !== null) {
      const candidate = cur as {
        status?: number;
        statusCode?: number;
        message?: string;
        statusText?: string;
      };
      if (
        candidate.status === HTTP_TOO_MANY_REQUESTS ||
        candidate.statusCode === HTTP_TOO_MANY_REQUESTS
      )
        return true;
      if (
        typeof candidate.message === "string" &&
        hasRateLimitSignal(candidate.message)
      )
        return true;
      if (
        typeof candidate.statusText === "string" &&
        hasRateLimitSignal(candidate.statusText)
      )
        return true;
    }
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
