import type { Node, Edge } from "@xyflow/react";
import type { TreeItem } from "./github";

// ─── Types ────────────────────────────────────────────────────────────
export type NodeRole = "entry" | "controller" | "service" | "model" | "util" | "config" | "test" | "api" | "file" | "folder";

export interface RepoNode extends Node {
    data: {
        label: string;
        path: string;
        type: "folder" | "file" | "api";
        role: NodeRole;
        language?: string;
        size?: number;
        imports?: string[];
        exports?: string[];
        apiMethods?: string[];
        externalApis?: string[];
        functionCalls?: { target: string; functions: string[] }[];
        summary?: string;
    };
}

export interface RepoEdge extends Edge {
    data?: {
        type: "tree" | "import" | "api" | "call";
        label?: string;
    };
}

// ─── Node Role Classification ────────────────────────────────────────
export function classifyNodeRole(path: string, content?: string): NodeRole {
    const lower = path.toLowerCase();

    // Entry points
    if (/^(server|app|main|index)\.(ts|js|py|go|rs)$/.test(lower)) return "entry";
    if (/^src\/(server|app|main|index)\.(ts|js)$/.test(lower)) return "entry";

    // API / Controllers
    if (/app\/api\/.*\/route\.(ts|js)$/.test(lower)) return "api";
    if (/pages\/api\//.test(lower)) return "api";
    if (/controllers?\//.test(lower)) return "controller";
    if (/routes?\//.test(lower)) return "controller";
    if (/endpoints?\//.test(lower)) return "controller";

    // If content has router/app HTTP methods
    if (content) {
        if (/(?:router|app)\.(get|post|put|delete)\s*\(/i.test(content)) return "controller";
        if (/@(?:app|router)\.(get|post|put|delete)\s*\(/i.test(content)) return "controller";
        if (/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(content)) return "api";
    }

    // Services
    if (/services?\//.test(lower)) return "service";
    if (/providers?\//.test(lower)) return "service";
    if (/use[A-Z]\w+\.(ts|js)$/.test(path)) return "service"; // React hooks as services

    // Models / Database
    if (/models?\//.test(lower)) return "model";
    if (/schema/.test(lower)) return "model";
    if (/migrations?\//.test(lower)) return "model";
    if (/entities?\//.test(lower)) return "model";
    if (/prisma/.test(lower)) return "model";

    // Utils / Helpers
    if (/utils?\//.test(lower)) return "util";
    if (/helpers?\//.test(lower)) return "util";
    if (/lib\//.test(lower)) return "util";
    if (/common\//.test(lower)) return "util";

    // Config
    if (/config/.test(lower)) return "config";
    if (/\.env/.test(lower)) return "config";
    if (/settings/.test(lower)) return "config";

    // Tests
    if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(lower)) return "test";
    if (/tests?\//.test(lower)) return "test";
    if (/__tests__\//.test(lower)) return "test";

    return "file";
}

// ─── External API Detection ─────────────────────────────────────────
export function detectExternalApis(content: string): string[] {
    const apis: string[] = [];

    // fetch / axios calls with URLs
    const fetchRegex = /(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*[`'"](https?:\/\/[^'"`\s]+)/g;
    let match;
    while ((match = fetchRegex.exec(content)) !== null) {
        apis.push(match[1]);
    }

    // Template literal URLs in fetch/axios
    const templateFetch = /(?:fetch|axios)\s*\(\s*`([^`]*\$\{[^`]*)`/g;
    while ((match = templateFetch.exec(content)) !== null) {
        apis.push(match[1].replace(/\$\{[^}]+\}/g, "{...}"));
    }

    // SDK patterns
    const sdkPatterns: [RegExp, string][] = [
        [/stripe/i, "Stripe API"],
        [/firebase/i, "Firebase"],
        [/aws-sdk|@aws-sdk/i, "AWS SDK"],
        [/supabase/i, "Supabase"],
        [/prisma/i, "Prisma ORM"],
        [/mongoose|mongodb/i, "MongoDB"],
        [/pg|postgres/i, "PostgreSQL"],
        [/redis/i, "Redis"],
        [/sendgrid|@sendgrid/i, "SendGrid"],
        [/twilio/i, "Twilio"],
        [/openai/i, "OpenAI API"],
        [/anthropic/i, "Anthropic API"],
        [/googleapis|@google-cloud/i, "Google Cloud"],
    ];

    for (const [pattern, name] of sdkPatterns) {
        if (pattern.test(content)) {
            apis.push(name);
        }
    }

    return [...new Set(apis)];
}

// ─── Function Call Tracing ──────────────────────────────────────────
export function traceFunctionCalls(
    content: string,
    filePath: string,
    imports: string[]
): { target: string; functions: string[] }[] {
    const calls: Map<string, Set<string>> = new Map();

    // For each imported module, find function calls
    for (const imp of imports) {
        const moduleName = imp.split("/").pop()?.replace(/\.\w+$/, "") || imp;
        // Look for ModuleName.functionName() patterns
        const callRegex = new RegExp(`${moduleName}\\.(\\w+)\\s*\\(`, "g");
        let match;
        while ((match = callRegex.exec(content)) !== null) {
            if (!calls.has(imp)) calls.set(imp, new Set());
            calls.get(imp)!.add(match[1]);
        }
    }

    // Also detect named import usage: import { foo } from './bar' then foo()
    const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = namedImportRegex.exec(content)) !== null) {
        const names = match[1].split(",").map((n) => n.trim().split(" as ")[0].trim());
        const source = match[2];
        if (source.startsWith(".")) {
            for (const name of names) {
                const callCheck = new RegExp(`\\b${name}\\s*\\(`, "g");
                if (callCheck.test(content)) {
                    const resolvedImport = imports.find((i) => i.includes(source.replace(/^\.\//, "")));
                    const target = resolvedImport || source;
                    if (!calls.has(target)) calls.set(target, new Set());
                    calls.get(target)!.add(name);
                }
            }
        }
    }

    return Array.from(calls.entries()).map(([target, fns]) => ({
        target,
        functions: Array.from(fns),
    }));
}

// ─── Mermaid Diagram Generation ─────────────────────────────────────
export function generateArchitectureMermaid(nodes: RepoNode[], edges: RepoEdge[]): string {
    const importEdges = edges.filter((e) => e.data?.type === "import" || e.data?.type === "call");
    if (importEdges.length === 0) return "";

    // Only include nodes that have edges
    const connectedIds = new Set<string>();
    for (const edge of importEdges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
    }

    const roleStyle: Record<string, string> = {
        entry: ":::entry",
        controller: ":::controller",
        api: ":::api",
        service: ":::service",
        model: ":::model",
        util: ":::util",
    };

    let diagram = "graph TD\n";
    diagram += "    classDef entry fill:#22c55e,stroke:#16a34a,color:#fff\n";
    diagram += "    classDef controller fill:#3b82f6,stroke:#2563eb,color:#fff\n";
    diagram += "    classDef api fill:#a855f7,stroke:#9333ea,color:#fff\n";
    diagram += "    classDef service fill:#06b6d4,stroke:#0891b2,color:#fff\n";
    diagram += "    classDef model fill:#f97316,stroke:#ea580c,color:#fff\n";
    diagram += "    classDef util fill:#6b7280,stroke:#4b5563,color:#fff\n";

    for (const node of nodes) {
        if (!connectedIds.has(node.id)) continue;
        const label = node.data.label;
        const style = roleStyle[node.data.role] || "";
        diagram += `    ${sanitizeMermaidId(node.id)}["${label}"]${style}\n`;
    }

    for (const edge of importEdges) {
        if (!connectedIds.has(edge.source) || !connectedIds.has(edge.target)) continue;
        const label = edge.data?.label || "imports";
        diagram += `    ${sanitizeMermaidId(edge.source)} -->|${label}| ${sanitizeMermaidId(edge.target)}\n`;
    }

    return diagram;
}

export function generateSequenceMermaid(
    apiNode: RepoNode,
    allNodes: RepoNode[],
    edges: RepoEdge[]
): string {
    const methods = apiNode.data.apiMethods?.join(", ") || "Request";
    const label = apiNode.data.label;

    // Find direct dependencies
    const directDeps = edges
        .filter((e) => e.source === apiNode.id && (e.data?.type === "import" || e.data?.type === "call"))
        .map((e) => allNodes.find((n) => n.id === e.target))
        .filter(Boolean) as RepoNode[];

    // Classify deps by role
    const services = directDeps.filter((n) => ["service", "util"].includes(n.data.role));
    const models = directDeps.filter((n) => n.data.role === "model");

    let seq = `sequenceDiagram\n`;
    seq += `    participant Client\n`;
    seq += `    participant ${sanitizeMermaidId(label)} as ${label}\n`;

    for (const svc of services.slice(0, 3)) {
        seq += `    participant ${sanitizeMermaidId(svc.data.label)} as ${svc.data.label}\n`;
    }
    for (const mdl of models.slice(0, 2)) {
        seq += `    participant ${sanitizeMermaidId(mdl.data.label)} as ${mdl.data.label}\n`;
    }

    seq += `    Client->>+${sanitizeMermaidId(label)}: ${methods} Request\n`;

    for (const svc of services.slice(0, 3)) {
        const fns = apiNode.data.functionCalls
            ?.find((fc) => fc.target.includes(svc.data.path))
            ?.functions.slice(0, 2).join(", ") || "process";
        seq += `    ${sanitizeMermaidId(label)}->>+${sanitizeMermaidId(svc.data.label)}: ${fns}()\n`;

        // If service calls a model
        for (const mdl of models.slice(0, 2)) {
            seq += `    ${sanitizeMermaidId(svc.data.label)}->>+${sanitizeMermaidId(mdl.data.label)}: query\n`;
            seq += `    ${sanitizeMermaidId(mdl.data.label)}-->>-${sanitizeMermaidId(svc.data.label)}: data\n`;
        }

        seq += `    ${sanitizeMermaidId(svc.data.label)}-->>-${sanitizeMermaidId(label)}: result\n`;
    }

    seq += `    ${sanitizeMermaidId(label)}-->>-Client: Response\n`;
    return seq;
}

function sanitizeMermaidId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

// ─── Level 1: File Tree → Graph ──────────────────────────────────────
export function treeToGraph(tree: TreeItem[]): { nodes: RepoNode[]; edges: RepoEdge[] } {
    const nodes: RepoNode[] = [];
    const edges: RepoEdge[] = [];
    const folderSet = new Set<string>();

    for (const item of tree) {
        const parts = item.path.split("/");
        for (let i = 1; i < parts.length; i++) {
            folderSet.add(parts.slice(0, i).join("/"));
        }
    }

    const sortedFolders = Array.from(folderSet).sort();
    for (const folder of sortedFolders) {
        const label = folder.split("/").pop() || folder;
        nodes.push({
            id: folder,
            type: "folderNode",
            position: { x: 0, y: 0 },
            data: { label, path: folder, type: "folder", role: "folder" },
        });

        const parentParts = folder.split("/");
        if (parentParts.length > 1) {
            const parent = parentParts.slice(0, -1).join("/");
            edges.push({
                id: `${parent}->${folder}`,
                source: parent,
                target: folder,
                type: "smoothstep",
                animated: false,
                style: { stroke: "oklch(0.4 0.02 260)", strokeWidth: 1 },
                data: { type: "tree" },
            });
        }
    }

    const fileItems = tree.filter((item) => item.type === "blob");
    for (const item of fileItems) {
        const label = item.path.split("/").pop() || item.path;
        const ext = label.split(".").pop()?.toLowerCase() || "";
        const role = classifyNodeRole(item.path);
        const isApi = role === "api" || role === "controller";

        nodes.push({
            id: item.path,
            type: isApi ? "apiNode" : "fileNode",
            position: { x: 0, y: 0 },
            data: {
                label,
                path: item.path,
                type: isApi ? "api" : "file",
                role,
                language: extToLanguage(ext),
                size: item.size,
            },
        });

        const parts = item.path.split("/");
        if (parts.length > 1) {
            const parent = parts.slice(0, -1).join("/");
            edges.push({
                id: `${parent}->${item.path}`,
                source: parent,
                target: item.path,
                type: "smoothstep",
                animated: false,
                style: { stroke: "oklch(0.4 0.02 260)", strokeWidth: 1 },
                data: { type: "tree" },
            });
        }
    }

    return { nodes: layoutGraph(nodes, edges), edges };
}

// ─── Level 2: Import Parsing ────────────────────────────────────────
export function parseImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const dir = filePath.split("/").slice(0, -1).join("/");

    const jsImportRegex = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match;
    while ((match = jsImportRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        if (importPath.startsWith(".")) {
            const resolved = resolvePath(dir, importPath);
            imports.push(resolved);
        }
    }

    const pyFromImport = /from\s+(\.\S+)\s+import/g;
    while ((match = pyFromImport.exec(content)) !== null) {
        const modPath = match[1].replace(/\./g, "/").replace(/^\//, "");
        const resolved = resolvePath(dir, "./" + modPath);
        imports.push(resolved);
    }

    return [...new Set(imports)];
}

export function parseExports(content: string): string[] {
    const exports: string[] = [];

    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    const pyExport = /^(?:def|class)\s+(\w+)/gm;
    while ((match = pyExport.exec(content)) !== null) {
        exports.push(match[1]);
    }

    return exports;
}

export function buildDependencyEdges(
    fileContents: Map<string, string>,
    existingNodes: RepoNode[]
): RepoEdge[] {
    const edges: RepoEdge[] = [];
    const nodeIds = new Set(existingNodes.map((n) => n.id));

    for (const [filePath, content] of fileContents) {
        const imports = parseImports(content, filePath);
        for (const imp of imports) {
            const candidates = [imp, `${imp}.ts`, `${imp}.tsx`, `${imp}.js`, `${imp}.jsx`, `${imp}/index.ts`, `${imp}/index.tsx`, `${imp}/index.js`, `${imp}.py`];
            const target = candidates.find((c) => nodeIds.has(c));
            if (target && target !== filePath) {
                // Determine edge label from function calls
                const fnCalls = traceFunctionCalls(content, filePath, [target]);
                const label = fnCalls.length > 0
                    ? `calls ${fnCalls[0].functions.slice(0, 2).join(", ")}`
                    : "imports";

                edges.push({
                    id: `dep:${filePath}->${target}`,
                    source: filePath,
                    target,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: "oklch(0.82 0.16 195)", strokeWidth: 1.5 },
                    label,
                    data: { type: fnCalls.length > 0 ? "call" : "import", label },
                });
            }
        }
    }

    return edges;
}

// ─── Level 3: API Route Discovery ───────────────────────────────────
export function isApiFile(path: string): boolean {
    const role = classifyNodeRole(path);
    return role === "api" || role === "controller";
}

export function detectApiMethods(content: string): string[] {
    const methods: string[] = [];
    let match;

    const expressRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(/gi;
    while ((match = expressRegex.exec(content)) !== null) {
        methods.push(match[1].toUpperCase());
    }

    const nextRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
    while ((match = nextRegex.exec(content)) !== null) {
        methods.push(match[1]);
    }

    const fastapiRegex = /@(?:app|router)\.(get|post|put|patch|delete)\s*\(/gi;
    while ((match = fastapiRegex.exec(content)) !== null) {
        methods.push(match[1].toUpperCase());
    }

    return [...new Set(methods)];
}

// ─── Helpers ────────────────────────────────────────────────────────
function resolvePath(from: string, importPath: string): string {
    const fromParts = from.split("/").filter(Boolean);
    const importParts = importPath.split("/").filter(Boolean);

    const result = [...fromParts];
    for (const part of importParts) {
        if (part === ".") continue;
        if (part === "..") { result.pop(); }
        else { result.push(part); }
    }
    return result.join("/");
}

function extToLanguage(ext: string): string {
    const map: Record<string, string> = {
        ts: "TypeScript", tsx: "TypeScript",
        js: "JavaScript", jsx: "JavaScript",
        py: "Python", go: "Go", rs: "Rust",
        java: "Java", rb: "Ruby", php: "PHP",
        json: "JSON", yaml: "YAML", yml: "YAML",
        md: "Markdown", css: "CSS", scss: "SCSS",
        html: "HTML", sql: "SQL", prisma: "Prisma",
        toml: "TOML", xml: "XML", sh: "Shell",
    };
    return map[ext] || ext.toUpperCase();
}

// ─── Smart Filtering ─────────────────────────────────────────────────
export function filterArchitectureNodes(
    nodes: RepoNode[],
    edges: RepoEdge[]
): { nodes: RepoNode[]; edges: RepoEdge[] } {
    // Keep: entry points, controllers, APIs, services, models + files that have dependency edges
    const importantRoles = new Set(["entry", "controller", "api", "service", "model"]);

    const connectedIds = new Set<string>();
    for (const edge of edges) {
        if (edge.data?.type === "import" || edge.data?.type === "call") {
            connectedIds.add(edge.source);
            connectedIds.add(edge.target);
        }
    }

    const keepIds = new Set<string>();
    for (const node of nodes) {
        if (node.data.type === "folder") continue; // folders handled separately
        if (importantRoles.has(node.data.role)) {
            keepIds.add(node.id);
        } else if (connectedIds.has(node.id)) {
            keepIds.add(node.id);
        }
    }

    // Add parent folders for kept files
    for (const id of Array.from(keepIds)) {
        const parts = id.split("/");
        for (let i = 1; i < parts.length; i++) {
            keepIds.add(parts.slice(0, i).join("/"));
        }
    }

    const filteredNodes = nodes.filter((n) => keepIds.has(n.id));
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = edges.filter(
        (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
}

// ─── Dagre Layout ─────────────────────────────────────────────────────
import Dagre from "@dagrejs/dagre";

export function layoutGraph(nodes: RepoNode[], edges: RepoEdge[]): RepoNode[] {
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

    g.setGraph({
        rankdir: "LR",        // left-to-right hierarchy
        nodesep: 60,          // vertical spacing between nodes in same rank
        ranksep: 200,         // horizontal spacing between ranks (depth levels)
        edgesep: 30,
        marginx: 40,
        marginy: 40,
    });

    for (const node of nodes) {
        const width = Math.max(160, node.data.label.length * 9 + 80);
        const height = node.data.type === "api" ? 70 : 55;
        g.setNode(node.id, { width, height });
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    Dagre.layout(g);

    return nodes.map((node) => {
        const pos = g.node(node.id);
        if (pos) {
            return {
                ...node,
                position: { x: pos.x - (pos.width || 160) / 2, y: pos.y - (pos.height || 55) / 2 },
            };
        }
        return node;
    });
}
