import { LRUCache } from "lru-cache";

// ─── Cache Instances ────────────────────────────────────────────────

/**
 * Cache for full repo analysis results.
 * Key: "owner/repo" → Value: complete analysis JSON
 * TTL: 10 minutes, Max: 50 repos
 */
export const repoCache = new LRUCache<string, object>({
    max: 50,
    ttl: 1000 * 60 * 10, // 10 minutes
});

/**
 * Cache for individual file contents fetched from GitHub.
 * Key: "owner/repo/path" → Value: file content string
 * TTL: 15 minutes, Max: 500 files
 */
export const fileCache = new LRUCache<string, string>({
    max: 500,
    ttl: 1000 * 60 * 15, // 15 minutes
});

/**
 * Cache for AI-generated file summaries.
 * Key: content hash → Value: AI summary object
 * TTL: 30 minutes, Max: 200 summaries
 */
export const summaryCache = new LRUCache<string, object>({
    max: 200,
    ttl: 1000 * 60 * 30, // 30 minutes
});

/**
 * Cache for GitHub repo tree (the list of all files).
 * Key: "owner/repo" → Value: tree items array
 * TTL: 10 minutes, Max: 50 repos
 */
export const treeCache = new LRUCache<string, object[]>({
    max: 50,
    ttl: 1000 * 60 * 10, // 10 minutes
});

// ─── Helpers ────────────────────────────────────────────────────────

/** Generate a simple hash for file content to use as cache key */
export function contentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const chr = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return `h_${hash.toString(36)}`;
}

/** Get cache stats for debugging */
export function getCacheStats() {
    return {
        repos: { size: repoCache.size, max: 50 },
        files: { size: fileCache.size, max: 500 },
        summaries: { size: summaryCache.size, max: 200 },
        trees: { size: treeCache.size, max: 50 },
    };
}
