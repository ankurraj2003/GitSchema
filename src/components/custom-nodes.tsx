"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import {
    Folder,
    FileCode,
    FileJson,
    FileText,
    Globe,
    Database,
    Settings,
    Image,
} from "lucide-react";

// ─── Folder Node ─────────────────────────────────────────────────────
function FolderNodeComponent({ data, selected }: NodeProps) {
    const nodeData = data as {
        label: string;
        path: string;
        type: string;
    };

    return (
        <div
            className={`
        group relative px-4 py-2.5 rounded-lg border transition-all duration-200
        bg-[oklch(0.14_0.02_260)] border-[oklch(0.25_0.03_260)]
        hover:border-[oklch(0.82_0.16_195/0.4)] hover:bg-[oklch(0.16_0.025_260)]
        ${selected ? "border-[oklch(0.82_0.16_195/0.6)] shadow-[0_0_15px_oklch(0.82_0.16_195/0.3),0_0_30px_oklch(0.82_0.16_195/0.1)]" : ""}
      `}
        >
            <Handle type="target" position={Position.Left} className="!bg-[oklch(0.82_0.16_195)] !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-[oklch(0.82_0.16_195)] !w-2 !h-2 !border-0" />
            <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-[oklch(0.7_0.15_60)]" />
                <span className="text-sm font-medium text-[oklch(0.85_0.01_260)]">{nodeData.label}</span>
            </div>
        </div>
    );
}

// ─── File Node ───────────────────────────────────────────────────────
function FileNodeComponent({ data, selected }: NodeProps) {
    const nodeData = data as {
        label: string;
        path: string;
        type: string;
        role?: string;
        language?: string;
        size?: number;
    };

    const Icon = getFileIcon(nodeData.label);
    const langColor = getLanguageColor(nodeData.language || "");
    const roleColor = getRoleColor(nodeData.role || "file");

    return (
        <div
            className={`
        group relative px-4 py-2.5 rounded-lg border transition-all duration-200 cursor-pointer
        bg-[oklch(0.12_0.015_260)] border-[oklch(0.22_0.025_260)]
        hover:border-[oklch(0.82_0.16_195/0.4)] hover:bg-[oklch(0.15_0.02_260)]
        hover:shadow-[0_0_12px_oklch(0.82_0.16_195/0.15)]
        ${selected ? "border-[oklch(0.82_0.16_195/0.6)] shadow-[0_0_15px_oklch(0.82_0.16_195/0.3),0_0_30px_oklch(0.82_0.16_195/0.1)]" : ""}
      `}
        >
            <Handle type="target" position={Position.Left} className="!bg-[oklch(0.82_0.16_195)] !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-[oklch(0.82_0.16_195)] !w-2 !h-2 !border-0" />
            {/* Role indicator dot */}
            {nodeData.role && nodeData.role !== "file" && (
                <div
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-[oklch(0.12_0.015_260)]"
                    style={{ backgroundColor: roleColor }}
                    title={nodeData.role}
                />
            )}
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: langColor }} />
                <span className="text-sm text-[oklch(0.8_0.01_260)]">{nodeData.label}</span>
            </div>
            {nodeData.language && (
                <div className="mt-1 flex items-center gap-1">
                    <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4"
                        style={{ borderColor: langColor + "40", color: langColor }}
                    >
                        {nodeData.language}
                    </Badge>
                    {nodeData.role && nodeData.role !== "file" && (
                        <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4"
                            style={{ borderColor: roleColor + "50", color: roleColor }}
                        >
                            {nodeData.role}
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── API Node ────────────────────────────────────────────────────────
function ApiNodeComponent({ data, selected }: NodeProps) {
    const nodeData = data as {
        label: string;
        path: string;
        type: string;
        apiMethods?: string[];
    };

    return (
        <div
            className={`
        group relative px-4 py-3 rounded-lg border-2 transition-all duration-200 cursor-pointer
        bg-[oklch(0.13_0.03_300)] border-[oklch(0.65_0.25_300/0.5)]
        hover:border-[oklch(0.65_0.25_300/0.8)] hover:bg-[oklch(0.15_0.04_300)]
        hover:shadow-[0_0_20px_oklch(0.65_0.25_300/0.2)]
        ${selected ? "border-[oklch(0.65_0.25_300/0.8)] shadow-[0_0_15px_oklch(0.65_0.25_300/0.3),0_0_30px_oklch(0.65_0.25_300/0.1)]" : ""}
      `}
        >
            <Handle type="target" position={Position.Left} className="!bg-[oklch(0.65_0.25_300)] !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-[oklch(0.65_0.25_300)] !w-2 !h-2 !border-0" />
            <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[oklch(0.65_0.25_300)]" />
                <span className="text-sm font-semibold text-[oklch(0.9_0.01_260)]">{nodeData.label}</span>
            </div>
            {nodeData.apiMethods && nodeData.apiMethods.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                    {nodeData.apiMethods.map((method) => (
                        <Badge
                            key={method}
                            className={`text-[10px] px-1.5 py-0 h-4 font-bold ${getMethodColor(method)}`}
                        >
                            {method}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────
function getFileIcon(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const iconMap: Record<string, typeof FileCode> = {
        ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
        py: FileCode, go: FileCode, rs: FileCode, java: FileCode,
        json: FileJson, yaml: Settings, yml: Settings, toml: Settings,
        md: FileText, txt: FileText, sql: Database, prisma: Database,
        png: Image, jpg: Image, svg: Image, gif: Image,
    };
    return iconMap[ext] || FileText;
}

function getLanguageColor(lang: string): string {
    const colors: Record<string, string> = {
        TypeScript: "#3178c6",
        JavaScript: "#f7df1e",
        Python: "#3776ab",
        Go: "#00add8",
        Rust: "#ce422b",
        Java: "#ed8b00",
        Ruby: "#cc342d",
        PHP: "#777bb4",
        "C#": "#239120",
        JSON: "#6d8346",
        CSS: "#1572b6",
        HTML: "#e34f26",
        SQL: "#e38c00",
        Prisma: "#2d3748",
        Markdown: "#666",
        Shell: "#89e051",
    };
    return colors[lang] || "#888";
}

function getRoleColor(role: string): string {
    const colors: Record<string, string> = {
        entry: "#22c55e",      // green
        controller: "#3b82f6", // blue
        service: "#06b6d4",    // cyan
        model: "#f97316",      // orange
        api: "#a855f7",        // purple
        util: "#6b7280",       // gray
        config: "#71717a",     // zinc
        test: "#78716c",       // stone
    };
    return colors[role] || "#888";
}

function getMethodColor(method: string): string {
    const colors: Record<string, string> = {
        GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        PATCH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return colors[method] || "bg-gray-500/20 text-gray-400";
}

export const FolderNode = memo(FolderNodeComponent);
export const FileNode = memo(FileNodeComponent);
export const ApiNode = memo(ApiNodeComponent);

export const nodeTypes = {
    folderNode: FolderNode,
    fileNode: FileNode,
    apiNode: ApiNode,
};
