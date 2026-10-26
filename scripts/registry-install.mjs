import assert from 'node:assert/strict';

// Version metadata can arrive before npm's package index. Never retry other failures.
export function isPendingRegistryVersion(error, name, version) {
  const stderr = String(error?.stderr ?? '');
  return Number.isInteger(error?.status) && error.status > 0 && /npm (?:error|ERR!) code ETARGET\b/.test(stderr)
    && stderr.includes(`No matching version found for ${name}@${version}.`);
}

export async function installRegistryVersion(install, {
  name, version, timeoutMs = 300000,
  now = () => performance.now(),
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  onRetry = () => {},
} = {}) {
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0, 'Registry installation needs a positive timeout');
  const deadline = now() + timeoutMs;
  let delayMs = 5000;
  let lastError;
  while (now() < deadline) {
    try {
      return await install(Math.max(1, Math.floor(deadline - now())));
    } catch (error) {
      if (!isPendingRegistryVersion(error, name, version)) throw error;
      lastError = error;
    }
    const delay = Math.min(delayMs, deadline - now());
    if (delay <= 0) break;
    onRetry(delay);
    await sleep(delay);
    delayMs = Math.min(delayMs * 2, 30000);
  }
  throw lastError;
}
