// Returns a StorageAdapter backed by the browser's localStorage when one is
// available (client component, post-hydration). Returns null during SSR or in
// non-browser environments — callers treat null as "no persistent storage" and
// keep state in memory. The unit tests inject their own in-memory adapter.
export function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  if (typeof window.localStorage === "undefined") return null;
  return wrapStorage(window.localStorage);
}

export function wrapStorage(storage) {
  return {
    getItem(key) {
      return storage.getItem(key);
    },
    setItem(key, value) {
      storage.setItem(key, value);
    },
    removeItem(key) {
      storage.removeItem(key);
    },
    keys() {
      const out = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key !== null) out.push(key);
      }
      return out;
    },
  };
}

// Recognizes the browser's QuotaExceededError without locking us to a specific
// implementation — Safari throws a generic Error with code 22, Firefox throws
// `NS_ERROR_DOM_QUOTA_REACHED`. Anything matching these heuristics goes through
// the quota-recovery path; anything else propagates.
export function isQuotaExceeded(error) {
  if (!error || typeof error !== "object") return false;
  const err = error;
  if (err.name === "QuotaExceededError") return true;
  if (err.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (err.code === 22 || err.code === 1014) return true;
  if (typeof err.message === "string" && /quota/i.test(err.message)) return true;
  return false;
}
