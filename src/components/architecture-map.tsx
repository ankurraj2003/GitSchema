"use client";

import { useCallback, useMemo, useState } from "react";
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./custom-nodes";
import { Filter, Layers, Eye, EyeOff } from "lucide-react";
import Dagre from "@dagrejs/dagre";

interface ArchitectureMapProps {
    nodes: Node[];
    edges: Edge[];
    onNodeClick?: (nodeId: string) => void;
}

type ViewMode = "architecture" | "all";

// ─── Client-side dagre re-layout ──────────────────────────────────
function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
    if (nodes.length === 0) return nodes;

    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

    g.setGraph({
        rankdir: "LR",
        nodesep: 60,
        ranksep: 200,
        edgesep: 30,
        marginx: 40,
        marginy: 40,
    });

    for (const node of nodes) {
        const label = (node.data as { label?: string }).label || "";
        const w = Math.max(160, label.length * 9 + 80);
        const h = node.type === "apiNode" ? 70 : 55;
        g.setNode(node.id, { width: w, height: h });
    }

    for (const edge of edges) {
        if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
            g.setEdge(edge.source, edge.target);
        }
    }

    Dagre.layout(g);

    return nodes.map((node) => {
        const pos = g.node(node.id);
        if (pos) {
            return { ...node, position: { x: pos.x - (pos.width || 160) / 2, y: pos.y - (pos.height || 55) / 2 } };
        }
        return node;
    });
}

// ─── Filter to important architecture nodes ─────────────────────
function filterImportantNodes(
    allNodes: Node[],
    allEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
    const importantRoles = new Set(["entry", "controller", "api", "service", "model"]);

    // Find nodes connected via import/call edges
    const connectedIds = new Set<string>();
    for (const edge of allEdges) {
        const edgeData = edge.data as { type?: string } | undefined;
        if (edgeData?.type === "import" || edgeData?.type === "call") {
            connectedIds.add(edge.source);
            connectedIds.add(edge.target);
        }
    }

    const keepIds = new Set<string>();
    for (const node of allNodes) {
        const d = node.data as { type?: string; role?: string };
        if (d.type === "folder") continue;
        if (importantRoles.has(d.role || "")) {
            keepIds.add(node.id);
        } else if (connectedIds.has(node.id)) {
            keepIds.add(node.id);
        }
    }

    // Include parent folders for kept files
    for (const id of Array.from(keepIds)) {
        const parts = id.split("/");
        for (let i = 1; i < parts.length; i++) {
            keepIds.add(parts.slice(0, i).join("/"));
        }
    }

    const filteredNodes = allNodes.filter((n) => keepIds.has(n.id));
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = allEdges.filter(
        (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
}

export default function ArchitectureMap({
    nodes: rawNodes,
    edges: rawEdges,
    onNodeClick,
}: ArchitectureMapProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("architecture");
    const [showFolders, setShowFolders] = useState(true);

    // Compute filtered + laid-out nodes
    const { displayNodes, displayEdges } = useMemo(() => {
        let workNodes: Node[];
        let workEdges: Edge[];

        if (viewMode === "architecture") {
            const filtered = filterImportantNodes(rawNodes, rawEdges);
            workNodes = filtered.nodes;
            workEdges = filtered.edges;
        } else {
            workNodes = rawNodes;
            workEdges = rawEdges;
        }

        // Optionally hide folders
        if (!showFolders) {
            const folderIds = new Set(
                workNodes.filter((n) => (n.data as { type?: string }).type === "folder").map((n) => n.id)
            );
            workNodes = workNodes.filter((n) => !folderIds.has(n.id));
            workEdges = workEdges.filter((e) => !folderIds.has(e.source) && !folderIds.has(e.target));
        }

        // Apply dagre layout
        const laid = applyDagreLayout(workNodes, workEdges);
        return { displayNodes: laid, displayEdges: workEdges };
    }, [rawNodes, rawEdges, viewMode, showFolders]);

    const [nodes, , onNodesChange] = useNodesState(displayNodes);
    const [edges, , onEdgesChange] = useEdgesState(displayEdges);

    // Sync state when displayNodes change (view toggle)
    const [prevKey, setPrevKey] = useState("");
    const currentKey = `${viewMode}-${showFolders}-${rawNodes.length}`;
    if (currentKey !== prevKey) {
        setPrevKey(currentKey);
    }

    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            if (onNodeClick) {
                onNodeClick(node.id);
            }
        },
        [onNodeClick]
    );

    return (
        <div className="w-full h-full relative">
            {/* View controls */}
            <div className="absolute top-3 left-3 z-10 flex gap-2">
                <button
                    onClick={() => setViewMode(viewMode === "architecture" ? "all" : "architecture")}
                    className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all
            ${viewMode === "architecture"
                            ? "bg-[oklch(0.82_0.16_195/0.15)] border-[oklch(0.82_0.16_195/0.4)] text-[oklch(0.82_0.16_195)]"
                            : "bg-[oklch(0.15_0.02_260)] border-[oklch(0.25_0.03_260)] text-[oklch(0.7_0.01_260)] hover:border-[oklch(0.35_0.03_260)]"
                        }
          `}
                >
                    {viewMode === "architecture" ? <Filter className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                    {viewMode === "architecture" ? "Architecture" : "All Files"}
                </button>
                <button
                    onClick={() => setShowFolders(!showFolders)}
                    className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all
            ${showFolders
                            ? "bg-[oklch(0.15_0.02_260)] border-[oklch(0.25_0.03_260)] text-[oklch(0.7_0.01_260)]"
                            : "bg-[oklch(0.65_0.25_300/0.15)] border-[oklch(0.65_0.25_300/0.4)] text-[oklch(0.65_0.25_300)]"
                        }
          `}
                >
                    {showFolders ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Folders
                </button>
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[oklch(0.12_0.015_260/0.8)] border border-[oklch(0.22_0.025_260)] text-[10px] text-[oklch(0.5_0.01_260)]">
                    {displayNodes.length} nodes · {displayEdges.length} edges
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-14 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 rounded-md bg-[oklch(0.1_0.015_260/0.9)] border border-[oklch(0.22_0.025_260)] text-[10px] text-[oklch(0.6_0.01_260)]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e]" />Entry</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a855f7]" />API</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" />Controller</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#06b6d4]" />Service</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]" />Model</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6b7280]" />Util</span>
            </div>

            <ReactFlow
                key={currentKey}
                nodes={displayNodes}
                edges={displayEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1 }}
                defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
                minZoom={0.05}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                defaultEdgeOptions={{
                    type: "smoothstep",
                    style: { strokeWidth: 1 },
                }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="oklch(0.3 0.02 260)"
                />
                <MiniMap
                    nodeStrokeWidth={3}
                    nodeColor={(node) => {
                        const d = node.data as { type?: string; role?: string };
                        if (d.role === "entry") return "#22c55e";
                        if (d.role === "api" || d.role === "controller") return "#a855f7";
                        if (d.role === "service") return "#06b6d4";
                        if (d.role === "model") return "#f97316";
                        if (d.type === "folder") return "oklch(0.7 0.15 60)";
                        return "oklch(0.82 0.16 195)";
                    }}
                    maskColor="oklch(0.08 0.01 260 / 80%)"
                    style={{
                        backgroundColor: "oklch(0.1 0.015 260)",
                    }}
                />
                <Controls />
            </ReactFlow>
        </div>
    );
}
