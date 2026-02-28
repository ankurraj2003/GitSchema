"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    X,
    FileCode,
    Globe,
    ArrowRight,
    Sparkles,
    Copy,
    Check,
    ExternalLink,
} from "lucide-react";

interface FileSidebarProps {
    filePath: string;
    fileContent: string;
    repoUrl: string;
    onClose: () => void;
}

interface AiSummary {
    summary: string;
    exports: string[];
    apiCalls: string[];
}

export default function FileSidebar({
    filePath,
    fileContent,
    repoUrl,
    onClose,
}: FileSidebarProps) {
    const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const filename = filePath.split("/").pop() || filePath;
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    const fetchSummary = async () => {
        if (aiSummary) return;
        setLoading(true);
        try {
            const res = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: fileContent, filename }),
            });
            const data = await res.json();
            setAiSummary(data);
        } catch {
            setAiSummary({
                summary: "Failed to generate summary.",
                exports: [],
                apiCalls: [],
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(fileContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Auto-fetch summary on mount
    if (!aiSummary && !loading) {
        fetchSummary();
    }

    return (
        <div className="w-full h-full flex flex-col bg-card/80 backdrop-blur-md border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-4 h-4 text-[oklch(0.82_0.16_195)] shrink-0" />
                    <span className="text-sm font-semibold truncate">{filename}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </Button>
                    <a
                        href={`${repoUrl}/blob/main/${filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 overflow-hidden">
                <div className="p-4 space-y-4 overflow-hidden">
                    {/* File info */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                            {ext.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            {fileContent.split("\n").length} lines
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            {(fileContent.length / 1024).toFixed(1)} KB
                        </Badge>
                    </div>

                    {/* Path */}
                    <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-3 py-2 rounded-md break-all">
                        {filePath}
                    </div>

                    <Separator />

                    {/* AI Summary */}
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[oklch(0.82_0.16_195)]" />
                            Summary
                        </h4>
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground leading-relaxed break-words">
                                {aiSummary?.summary || "Analyzing..."}
                            </p>
                        )}
                    </div>

                    {/* Exports */}
                    {aiSummary && aiSummary.exports.length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                                    Exported ({aiSummary.exports.length})
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {aiSummary.exports.map((exp) => (
                                        <Badge
                                            key={exp}
                                            variant="outline"
                                            className="text-xs font-mono bg-emerald-500/5 border-emerald-500/20 text-emerald-300"
                                        >
                                            {exp}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* API Calls */}
                    {aiSummary && aiSummary.apiCalls.length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-[oklch(0.65_0.25_300)]" />
                                    API Calls ({aiSummary.apiCalls.length})
                                </h4>
                                <div className="space-y-1">
                                    {aiSummary.apiCalls.map((url, i) => (
                                        <div
                                            key={i}
                                            className="text-xs font-mono text-muted-foreground bg-[oklch(0.65_0.25_300/0.05)] px-2 py-1.5 rounded border border-[oklch(0.65_0.25_300/0.1)] break-all"
                                        >
                                            {url}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    {/* Code Preview */}
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Code Preview
                        </h4>
                        <pre className="text-xs font-mono text-muted-foreground bg-muted/20 p-3 rounded-md overflow-x-auto overflow-y-auto max-h-80 whitespace-pre-wrap break-all">
                            <code>{fileContent.slice(0, 3000)}</code>
                            {fileContent.length > 3000 && (
                                <span className="text-[oklch(0.82_0.16_195)] block mt-2">
                                    ... ({fileContent.length - 3000} more characters)
                                </span>
                            )}
                        </pre>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
