import { Octokit } from "@octokit/rest";
import { fileCache, treeCache } from "./cache";

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});

export interface RepoMeta {
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
}

export interface TreeItem {
    path: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
}

export interface FileContent {
    path: string;
    content: string;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
        /github\.com\/([^/]+)\/([^/\s?#]+)/,
        /^([^/]+)\/([^/\s?#]+)$/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
        }
    }
    return null;
}

export async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
    const { data } = await octokit.repos.get({ owner, repo });
    return {
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        language: data.language,
        stars: data.stargazers_count,
        forks: data.forks_count,
        defaultBranch: data.default_branch,
    };
}

export async function fetchRepoTree(owner: string, repo: string, branch: string): Promise<TreeItem[]> {
    const cacheKey = `${owner}/${repo}`;
    const cached = treeCache.get(cacheKey) as TreeItem[] | undefined;
    if (cached) {
        console.log(`[CACHE HIT] tree: ${cacheKey}`);
        return cached;
    }

    const { data } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: "true",
    });
    const items = (data.tree as TreeItem[]).filter(
        (item) => item.path && !item.path.startsWith(".")
    );

    treeCache.set(cacheKey, items);
    console.log(`[CACHE SET] tree: ${cacheKey} (${items.length} items)`);
    return items;
}

export async function fetchFileContent(
    owner: string,
    repo: string,
    path: string
): Promise<string> {
    const cacheKey = `${owner}/${repo}/${path}`;
    const cached = fileCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        if ("content" in data && typeof data.content === "string") {
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            fileCache.set(cacheKey, content);
            return content;
        }
        fileCache.set(cacheKey, "");
        return "";
    } catch {
        fileCache.set(cacheKey, "");
        return "";
    }
}

export function detectPrimaryLanguage(tree: TreeItem[]): string {
    const extCounts: Record<string, number> = {};
    const extToLang: Record<string, string> = {
        ts: "TypeScript", tsx: "TypeScript",
        js: "JavaScript", jsx: "JavaScript",
        py: "Python", go: "Go", rs: "Rust",
        java: "Java", rb: "Ruby", php: "PHP",
        cs: "C#", cpp: "C++", c: "C",
        swift: "Swift", kt: "Kotlin",
    };

    for (const item of tree) {
        if (item.type === "blob") {
            const ext = item.path.split(".").pop()?.toLowerCase() || "";
            if (extToLang[ext]) {
                extCounts[ext] = (extCounts[ext] || 0) + 1;
            }
        }
    }

    const topExt = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0];
    return topExt ? extToLang[topExt[0]] : "Unknown";
}
