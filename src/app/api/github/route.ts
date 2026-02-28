import { NextResponse } from "next/server";
import {
    parseGitHubUrl,
    fetchRepoMeta,
    fetchRepoTree,
    fetchFileContent,
    detectPrimaryLanguage,
} from "@/lib/github";
import {
    treeToGraph,
    buildDependencyEdges,
    parseImports,
    parseExports,
    detectApiMethods,
    isApiFile,
    classifyNodeRole,
    detectExternalApis,
    traceFunctionCalls,
    generateArchitectureMermaid,
    generateSequenceMermaid,
} from "@/lib/parser";
import {
    detectSchemaFiles,
    parsePrismaSchema,
    parseSqlSchema,
    entitiesToMermaidERD,
} from "@/lib/schema-parser";
import { repoCache, getCacheStats } from "@/lib/cache";

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        const parsed = parseGitHubUrl(url);
        if (!parsed) {
            return NextResponse.json(
                { error: "Invalid GitHub URL. Expected format: github.com/owner/repo" },
                { status: 400 }
            );
        }

        const { owner, repo } = parsed;
        const cacheKey = `${owner}/${repo}`;

        // ─── Check full repo cache ──────────────────────────────────
        const cached = repoCache.get(cacheKey);
        if (cached) {
            console.log(`[CACHE HIT] Full repo analysis: ${cacheKey}`);
            console.log(`[CACHE STATS]`, getCacheStats());
            return NextResponse.json(cached);
        }

        console.log(`[CACHE MISS] Analyzing: ${cacheKey}`);
        const startTime = Date.now();

        // ─── Step 1: Fetch repo metadata and file tree ──────────────
        const [meta, tree] = await Promise.all([
            fetchRepoMeta(owner, repo),
            fetchRepoTree(owner, repo, "HEAD"),
        ]);

        const language = meta.language || detectPrimaryLanguage(tree);

        // ─── Step 2: Build Level 1 — File tree graph ────────────────
        const { nodes, edges } = treeToGraph(tree);

        // ─── Step 3: Identify parseable files ───────────────────────
        const parseableExts = new Set(["ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "rb"]);
        const parseableFiles = tree
            .filter((item) => {
                if (item.type !== "blob") return false;
                const ext = item.path.split(".").pop()?.toLowerCase() || "";
                return parseableExts.has(ext);
            })
            .slice(0, 60);

        // ─── Step 4: Fetch file contents ────────────────────────────
        const fileContents = new Map<string, string>();
        const batchSize = 10;
        for (let i = 0; i < parseableFiles.length; i += batchSize) {
            const batch = parseableFiles.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (file) => {
                    const content = await fetchFileContent(owner, repo, file.path);
                    if (content) fileContents.set(file.path, content);
                })
            );
        }

        // ─── Step 5: Build Level 2 — Dependency edges ───────────────
        const depEdges = buildDependencyEdges(fileContents, nodes);

        // ─── Step 6: Enhance nodes with parsed data ─────────────────
        for (const node of nodes) {
            const content = fileContents.get(node.data.path);
            if (content) {
                // Re-classify role with content awareness
                node.data.role = classifyNodeRole(node.data.path, content);
                const isApi = node.data.role === "api" || node.data.role === "controller";
                if (isApi) {
                    node.data.type = "api";
                    node.type = "apiNode";
                }

                node.data.imports = parseImports(content, node.data.path);
                node.data.exports = parseExports(content);
                node.data.externalApis = detectExternalApis(content);
                node.data.functionCalls = traceFunctionCalls(content, node.data.path, node.data.imports);

                if (isApiFile(node.data.path)) {
                    node.data.apiMethods = detectApiMethods(content);
                }
            }
        }

        // ─── Step 7: Detect schema files and build ERD ──────────────
        const schemaPaths = detectSchemaFiles(tree.map((t) => t.path));
        let erdDiagram = "";
        for (const schemaPath of schemaPaths) {
            const content = fileContents.get(schemaPath) || await fetchFileContent(owner, repo, schemaPath);
            if (content) {
                let entities;
                if (schemaPath.endsWith(".prisma")) {
                    entities = parsePrismaSchema(content);
                } else if (schemaPath.endsWith(".sql")) {
                    entities = parseSqlSchema(content);
                }
                if (entities && entities.length > 0) {
                    erdDiagram = entitiesToMermaidERD(entities);
                    break;
                }
            }
        }

        // ─── Step 8: Generate Mermaid diagrams ──────────────────────
        const allEdges = [...edges, ...depEdges];

        // Architecture overview
        const architectureMermaid = generateArchitectureMermaid(nodes, allEdges);

        // Sequence diagrams for each API endpoint
        const apiNodes = nodes.filter((n) => n.data.type === "api");
        const logicFlows: Record<string, string> = {};
        for (const apiNode of apiNodes) {
            logicFlows[apiNode.data.path] = generateSequenceMermaid(apiNode, nodes, allEdges);
        }

        // ─── Step 9: Generate repo summary ──────────────────────────
        const entryPoints = nodes.filter((n) => n.data.role === "entry");
        const controllers = nodes.filter((n) => ["api", "controller"].includes(n.data.role));
        const services = nodes.filter((n) => n.data.role === "service");
        const models = nodes.filter((n) => n.data.role === "model");

        const allExternalApis = new Set<string>();
        for (const node of nodes) {
            if (node.data.externalApis) {
                for (const api of node.data.externalApis) {
                    allExternalApis.add(api);
                }
            }
        }

        const summary = `A ${language} repository with ${tree.filter(t => t.type === "blob").length} files. ` +
            `Architecture: ${entryPoints.length} entry point(s), ${controllers.length} API route(s), ` +
            `${services.length} service(s), ${models.length} model(s).` +
            (allExternalApis.size > 0 ? ` External integrations: ${Array.from(allExternalApis).slice(0, 5).join(", ")}.` : "");

        const elapsed = Date.now() - startTime;
        console.log(`[ANALYSIS COMPLETE] ${cacheKey} in ${elapsed}ms`);

        // ─── Build response ─────────────────────────────────────────
        const result = {
            summary,
            meta: { ...meta, language },
            nodes,
            edges: allEdges,
            fileContents: Object.fromEntries(fileContents),
            erdDiagram,
            logicFlows,
            mermaid: {
                flow: architectureMermaid,
                sequence: Object.values(logicFlows)[0] || "",
            },
            stats: {
                totalFiles: tree.filter((t) => t.type === "blob").length,
                totalFolders: tree.filter((t) => t.type === "tree").length,
                parsedFiles: fileContents.size,
                apiEndpoints: apiNodes.length,
                schemaFiles: schemaPaths.length,
                entryPoints: entryPoints.length,
                services: services.length,
                models: models.length,
                externalApis: allExternalApis.size,
                analysisTimeMs: elapsed,
                cached: false,
            },
        };

        // ─── Store in cache ─────────────────────────────────────────
        repoCache.set(cacheKey, { ...result, stats: { ...result.stats, cached: true } });
        console.log(`[CACHE SET] ${cacheKey}`);
        console.log(`[CACHE STATS]`, getCacheStats());

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("GitHub API error:", error);
        const message = error instanceof Error ? error.message : "Failed to analyze repository";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
