"""
Cache module — LRU caches for repo analysis, file contents, summaries, and trees.
Port of src/lib/cache.ts
"""

from cachetools import TTLCache

# ─── Cache Instances ────────────────────────────────────────────────

# Cache for full repo analysis results.
# Key: "owner/repo" → Value: complete analysis dict
# TTL: 10 minutes, Max: 50 repos
repo_cache: TTLCache = TTLCache(maxsize=50, ttl=600)

# Cache for individual file contents fetched from GitHub.
# Key: "owner/repo/path" → Value: file content string
# TTL: 15 minutes, Max: 500 files
file_cache: TTLCache = TTLCache(maxsize=500, ttl=900)

# Cache for AI-generated file summaries.
# Key: content hash → Value: AI summary dict
# TTL: 30 minutes, Max: 200 summaries
summary_cache: TTLCache = TTLCache(maxsize=200, ttl=1800)

# Cache for GitHub repo tree (the list of all files).
# Key: "owner/repo" → Value: tree items list
# TTL: 10 minutes, Max: 50 repos
tree_cache: TTLCache = TTLCache(maxsize=50, ttl=600)


# ─── Helpers ────────────────────────────────────────────────────────

def content_hash(content: str) -> str:
    """Generate a simple hash for file content to use as cache key."""
    h = 0
    for ch in content:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF  # Keep as 32-bit integer
    # Convert to signed 32-bit
    if h >= 0x80000000:
        h -= 0x100000000
    return f"h_{h:x}"


def get_cache_stats() -> dict:
    """Get cache stats for debugging."""
    return {
        "repos": {"size": len(repo_cache), "max": repo_cache.maxsize},
        "files": {"size": len(file_cache), "max": file_cache.maxsize},
        "summaries": {"size": len(summary_cache), "max": summary_cache.maxsize},
        "trees": {"size": len(tree_cache), "max": tree_cache.maxsize},
    }
