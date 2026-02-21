/**
 * sync-utils.js
 * Utility for local data synchronization.
 * Checks localStorage for data overrides (saved via Admin Panel) 
 * before falling back to static JSON data.
 */
window.SyncUtils = {
    /**
     * getOverride
     * @param {string} key - The data key (e.g., 'inventory', 'settings')
     * @param {any} fallbackData - The data fetched from the JSON file
     * @returns {any} - The overridden or original data
     */
    getOverride: (key, fallbackData) => {
        const storageKey = `md_data_${key}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                console.log(`[SYNC] Using localStorage override for: ${key}`, {
                    items: Array.isArray(parsed) ? parsed.length : 'Object'
                });
                return parsed;
            } catch (e) {
                console.error(`[SYNC] Failed to parse localStorage for ${key}`, e);
            }
        }
        return fallbackData;
    }
};
