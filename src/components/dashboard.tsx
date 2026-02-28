"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Network,
    GitBranch,
    Database,
    Star,
    GitFork,
    Code2,
    FileCode,
    Folder,
    Globe,
    ChevronRight,
    ChevronDown,
    ArrowLeft,
} from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import ArchitectureMap from "./architecture-map";
import LogicFlow from "./logic-flow";
import SchemaView from "./schema-view";
import FileSidebar from "./file-sidebar";
import DeepDive from "./deep-dive";

interface RepoMeta {
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
}

interface RepoStats {
    totalFiles: number;
    totalFolders: number;
    parsedFiles: number;
    apiEndpoints: number;
    schemaFiles: number;
}

interface DashboardProps {
    meta: RepoMeta;
    nodes: Node[];
    edges: Edge[];
    fileContents: Record<string, string>;
    erdDiagram: string;
    logicFlows: Record<string, string>;
    stats: RepoStats;
    repoUrl: string;
    onBack: () => void;
}

interface TreeNode {
    name: string;
    path: string;
    type: "folder" | "file" | "api";
    children: TreeNode[];
}

export default function Dashboard({
    meta,
    nodes,
    edges,
    fileContents,
    erdDiagram,
    logicFlows,
    stats,
    repoUrl,
    onBack,
}: DashboardProps) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [previousFile, setPreviousFile] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState("architecture");

    // Build file tree from nodes
    const fileTree = buildFileTree(nodes);

    const handleNodeClick = useCallback(
        (nodeId: string) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node && node.data?.type !== "folder") {
                setPreviousFile(selectedFile);
                setSelectedFile(nodeId);
            }
        },
        [nodes, selectedFile]
    );

    const toggleFolder = (path: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const selectedFileContent = selectedFile ? fileContents[selectedFile] || "" : "";
    const previousFileData = previousFile
        ? { path: previousFile, content: fileContents[previousFile] || "" }
        : null;
    const selectedFileData = selectedFile
        ? { path: selectedFile, content: selectedFileContent }
        : null;

    return (
        <div className="flex flex-col h-screen">
            {/* Top Bar */}
            <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md flex items-center px-4 gap-4 shrink-0">
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="text-sm font-semibold truncate">{meta.fullName}</h1>
                    {meta.language && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                            <Code2 className="w-3 h-3 mr-1" />
                            {meta.language}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-500" />
                        {meta.stars.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                        <GitFork className="w-3.5 h-3.5" />
                        {meta.forks.toLocaleString()}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>{stats.totalFiles} files</span>
                    <span>{stats.apiEndpoints} APIs</span>
                </div>

                {/* Deep Dive */}
                <DeepDive fileA={previousFileData} fileB={selectedFileData} />
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left sidebar — File Tree */}
                <aside className="w-60 border-r border-border bg-card/30 flex flex-col shrink-0">
                    <div className="p-3 border-b border-border">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            File Explorer
                        </h2>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2">
                            {fileTree.map((node) => (
                                <TreeItem
                                    key={node.path}
                                    node={node}
                                    expandedFolders={expandedFolders}
                                    toggleFolder={toggleFolder}
                                    onFileClick={handleNodeClick}
                                    selectedFile={selectedFile}
                                    depth={0}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                    {/* Stats */}
                    <div className="p-3 border-t border-border space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Parsed</span>
                            <span className="text-foreground">{stats.parsedFiles} files</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>API Endpoints</span>
                            <span className="text-[oklch(0.65_0.25_300)]">{stats.apiEndpoints}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Schemas</span>
                            <span className="text-foreground">{stats.schemaFiles}</span>
                        </div>
                    </div>
                </aside>

                {/* Center — Visualization */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
                        <div className="border-b border-border px-4 bg-card/20">
                            <TabsList className="h-10 bg-transparent gap-1">
                                <TabsTrigger
                                    value="architecture"
                                    className="data-[state=active]:bg-[oklch(0.82_0.16_195/0.1)] data-[state=active]:text-[oklch(0.82_0.16_195)] gap-1.5 text-xs"
                                >
                                    <Network className="w-3.5 h-3.5" />
                                    Architecture Map
                                </TabsTrigger>
                                <TabsTrigger
                                    value="logic"
                                    className="data-[state=active]:bg-[oklch(0.65_0.25_300/0.1)] data-[state=active]:text-[oklch(0.65_0.25_300)] gap-1.5 text-xs"
                                >
                                    <GitBranch className="w-3.5 h-3.5" />
                                    Logic Flow
                                </TabsTrigger>
                                <TabsTrigger
                                    value="schema"
                                    className="data-[state=active]:bg-[oklch(0.75_0.2_155/0.1)] data-[state=active]:text-[oklch(0.75_0.2_155)] gap-1.5 text-xs"
                                >
                                    <Database className="w-3.5 h-3.5" />
                                    Schema View
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="architecture" className="flex-1 m-0 overflow-hidden">
                            <ArchitectureMap
                                nodes={nodes}
                                edges={edges}
                                onNodeClick={handleNodeClick}
                            />
                        </TabsContent>

                        <TabsContent value="logic" className="flex-1 m-0 overflow-auto">
                            <LogicFlow
                                diagrams={logicFlows}
                                selectedEndpoint={selectedFile}
                            />
                        </TabsContent>

                        <TabsContent value="schema" className="flex-1 m-0 overflow-auto">
                            <SchemaView erdDiagram={erdDiagram} />
                        </TabsContent>
                    </Tabs>
                </main>

                {/* Right sidebar — File details */}
                {selectedFile && selectedFileContent && (
                    <aside className="hidden lg:block w-96 shrink-0 overflow-hidden transition-all duration-300">
                        <FileSidebar
                            filePath={selectedFile}
                            fileContent={selectedFileContent}
                            repoUrl={repoUrl}
                            onClose={() => setSelectedFile(null)}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
}

// ─── File Tree Builder ──────────────────────────────────────────────
function buildFileTree(nodes: Node[]): TreeNode[] {
    const root: TreeNode[] = [];
    const map = new Map<string, TreeNode>();

    // Sort nodes by path
    const sorted = [...nodes].sort((a, b) =>
        (a.data?.path as string || "").localeCompare(b.data?.path as string || "")
    );

    for (const node of sorted) {
        const path = node.data?.path as string;
        const type = node.data?.type as "folder" | "file" | "api";
        if (!path) continue;

        const parts = path.split("/");
        const name = parts[parts.length - 1];

        const treeNode: TreeNode = { name, path, type, children: [] };
        map.set(path, treeNode);

        if (parts.length === 1) {
            root.push(treeNode);
        } else {
            const parentPath = parts.slice(0, -1).join("/");
            const parent = map.get(parentPath);
            if (parent) {
                parent.children.push(treeNode);
            } else {
                root.push(treeNode);
            }
        }
    }

    return root;
}

// ─── Tree Item Component ────────────────────────────────────────────
function TreeItem({
    node,
    expandedFolders,
    toggleFolder,
    onFileClick,
    selectedFile,
    depth,
}: {
    node: TreeNode;
    expandedFolders: Set<string>;
    toggleFolder: (path: string) => void;
    onFileClick: (path: string) => void;
    selectedFile: string | null;
    depth: number;
}) {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const isFolder = node.type === "folder";
    const isApi = node.type === "api";

    const Icon = isFolder ? Folder : isApi ? Globe : FileCode;
    const Chevron = isExpanded ? ChevronDown : ChevronRight;

    return (
        <div>
            <button
                onClick={() => {
                    if (isFolder) {
                        toggleFolder(node.path);
                    } else {
                        onFileClick(node.path);
                    }
                }}
                className={`
          w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
          hover:bg-muted/50
          ${isSelected ? "bg-[oklch(0.82_0.16_195/0.1)] text-[oklch(0.82_0.16_195)]" : "text-muted-foreground"}
          ${isApi ? "text-[oklch(0.65_0.25_300)]" : ""}
        `}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
                {isFolder && <Chevron className="w-3 h-3 shrink-0 opacity-50" />}
                {!isFolder && <span className="w-3" />}
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{node.name}</span>
            </button>

            {isFolder && isExpanded && (
                <div>
                    {node.children.map((child) => (
                        <TreeItem
                            key={child.path}
                            node={child}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                            onFileClick={onFileClick}
                            selectedFile={selectedFile}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
