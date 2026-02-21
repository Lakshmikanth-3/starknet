/**
 * LockManager — PrivateBTC Vault
 *
 * In-memory locking system to prevent race conditions on critical operations.
 * Includes automatic timeout protection to prevent deadlocks.
 */

class LockManager {
    private locks: Map<string, boolean> = new Map();
    private timeouts: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Executes an async function with an exclusive lock on the given key.
     * Throws an error if the key is already locked.
     */
    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        if (this.isLocked(key)) {
            throw new Error('Resource is locked — concurrent operation in progress');
        }

        // Set the lock
        this.locks.set(key, true);

        // Safety timeout: force release after 30 seconds to prevent deadlocks
        const timeout = setTimeout(() => {
            if (this.locks.has(key)) {
                console.warn(`[LockManager] WARNING: Lock for key "${key}" timed out after 30s and was force-released.`);
                this.releaseLock(key);
            }
        }, 30000);

        this.timeouts.set(key, timeout);

        try {
            return await fn();
        } finally {
            this.releaseLock(key);
        }
    }

    /**
     * Checks if a key is currently locked.
     */
    isLocked(key: string): boolean {
        return this.locks.get(key) === true;
    }

    /**
     * Frees the lock and clears any associated timeouts.
     */
    private releaseLock(key: string): void {
        this.locks.delete(key);
        const timeout = this.timeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(key);
        }
    }
}

// Export singleton instance
export const lockManager = new LockManager();
