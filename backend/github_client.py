"""
GitHub client — Fetches repo metadata, file trees, and file content from the GitHub API.
Port of src/lib/github.ts
"""

import os
import re
import base64
from typing import Optional

import httpx

from cache_module import file_cache, tree_cache

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

_headers: dict[str, str] = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
if GITHUB_TOKEN:
    _headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"


# ─── Types ──────────────────────────────────────────────────────────

class RepoMeta(dict):
    """Repo metadata dictionary."""
    pass


class TreeItem(dict):
    """Tree item dictionary with path, type, sha, size."""
    pass


# ─── URL Parsing ────────────────────────────────────────────────────

def parse_github_url(url: str) -> Optional[dict[str, str]]:
    """Parse a GitHub URL into owner and repo."""
    patterns = [
        r"github\.com/([^/]+)/([^/\s?#]+)",
        r"^([^/]+)/([^/\s?#]+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            repo = re.sub(r"\.git$", "", match.group(2))
            return {"owner": match.group(1), "repo": repo}
    return None


# ─── API Functions ──────────────────────────────────────────────────

async def fetch_repo_meta(owner: str, repo: str) -> dict:
    """Fetch repository metadata from GitHub."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=_headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()

    return {
        "name": data["name"],
        "fullName": data["full_name"],
        "description": data.get("description"),
        "language": data.get("language"),
        "stars": data.get("stargazers_count", 0),
        "forks": data.get("forks_count", 0),
        "defaultBranch": data.get("default_branch", "main"),
    }


async def fetch_repo_tree(owner: str, repo: str, branch: str = "HEAD") -> list[dict]:
    """Fetch the recursive file tree for a repository."""
    cache_key = f"{owner}/{repo}"
    cached = tree_cache.get(cache_key)
    if cached is not None:
        print(f"[CACHE HIT] tree: {cache_key}")
        return cached

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=true",
            headers=_headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()

    items = [
        {
            "path": item["path"],
            "type": item["type"],
            "sha": item["sha"],
            "size": item.get("size"),
        }
        for item in data.get("tree", [])
        if item.get("path") and not item["path"].startswith(".")
    ]

    tree_cache[cache_key] = items
    print(f"[CACHE SET] tree: {cache_key} ({len(items)} items)")
    return items


async def fetch_file_content(owner: str, repo: str, path: str) -> str:
    """Fetch the content of a single file from a repository."""
    cache_key = f"{owner}/{repo}/{path}"
    cached = file_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{path}",
                headers=_headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()

        if "content" in data and isinstance(data["content"], str):
            content = base64.b64decode(data["content"]).decode("utf-8")
            file_cache[cache_key] = content
            return content

        file_cache[cache_key] = ""
        return ""
    except Exception:
        file_cache[cache_key] = ""
        return ""


# ─── Language Detection ─────────────────────────────────────────────

def detect_primary_language(tree: list[dict]) -> str:
    """Detect the primary programming language from file extensions."""
    ext_to_lang = {
        "ts": "TypeScript", "tsx": "TypeScript",
        "js": "JavaScript", "jsx": "JavaScript",
        "py": "Python", "go": "Go", "rs": "Rust",
        "java": "Java", "rb": "Ruby", "php": "PHP",
        "cs": "C#", "cpp": "C++", "c": "C",
        "swift": "Swift", "kt": "Kotlin",
    }

    ext_counts: dict[str, int] = {}
    for item in tree:
        if item["type"] == "blob":
            ext = item["path"].rsplit(".", 1)[-1].lower() if "." in item["path"] else ""
            if ext in ext_to_lang:
                ext_counts[ext] = ext_counts.get(ext, 0) + 1

    if not ext_counts:
        return "Unknown"

    top_ext = max(ext_counts, key=ext_counts.get)  # type: ignore[arg-type]
    return ext_to_lang.get(top_ext, "Unknown")
