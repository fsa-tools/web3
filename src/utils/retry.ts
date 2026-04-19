const DEFAULT_BASE_MS = 1_000;
const DEFAULT_MAX_MS = 30_000;
const DEFAULT_ATTEMPTS = 3;

export type RetryOptions = {
  base?: number;
  max?: number;
  attempts?: number;
};

function computeDelay(attempt: number, base: number, max: number): number {
  const exponential = base * 2 ** attempt;
  const capped = Math.min(exponential, max);
  return Math.random() * capped;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const base = options.base ?? DEFAULT_BASE_MS;
  const max = options.max ?? DEFAULT_MAX_MS;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        const delay = computeDelay(attempt, base, max);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
