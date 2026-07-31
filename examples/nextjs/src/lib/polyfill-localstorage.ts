// Polyfill localStorage in Node.js server environment for libraries expecting browser localStorage
if (typeof window === "undefined") {
    if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage?.getItem !== "function") {
        const storage: Record<string, string> = {};
        const noopStorage = {
            getItem: (key: string) => storage[key] ?? null,
            setItem: (key: string, value: string) => { storage[key] = String(value); },
            removeItem: (key: string) => { delete storage[key]; },
            clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
            key: (index: number) => Object.keys(storage)[index] ?? null,
            length: 0,
        };
        try {
            Object.defineProperty(globalThis, "localStorage", {
                value: noopStorage,
                writable: true,
                configurable: true,
            });
        } catch {
            (globalThis as unknown as Record<string, unknown>).localStorage = noopStorage;
        }
    }
}
