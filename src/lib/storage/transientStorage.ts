const TRANSIENT_SESSION_PREFIX = "wp_transient:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function sessionKey(key: string): string {
  return `${TRANSIENT_SESSION_PREFIX}${key}`;
}

export function readTransientString(key: string): string | null {
  if (!isBrowser()) return null;

  const fromSession = window.sessionStorage.getItem(sessionKey(key));
  if (fromSession != null) {
    return fromSession;
  }

  const fromLocal = window.localStorage.getItem(key);
  if (fromLocal == null) {
    return null;
  }

  try {
    window.sessionStorage.setItem(sessionKey(key), fromLocal);
  } catch {
    // Best effort only.
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best effort only.
  }

  return fromLocal;
}

export function writeTransientString(key: string, value: string): void {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(sessionKey(key), value);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best effort only.
  }
}

export function removeTransientKey(key: string): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(sessionKey(key));
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best effort only.
  }
}

export function migrateLocalKeysToTransient(keys: string[]): void {
  if (!isBrowser()) return;
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value == null) continue;
    try {
      window.sessionStorage.setItem(sessionKey(key), value);
    } catch {
      // Ignore session quota failures.
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Best effort only.
    }
  }
}

export function removeLocalStorageKeysByPrefix(prefixes: string[]): void {
  if (!isBrowser()) return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Best effort only.
    }
  }
}
