"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Zap } from "lucide-react";

interface DeepDiveProps {
    fileA: { path: string; content: string } | null;
    fileB: { path: string; content: string } | null;
}

export default function DeepDive({ fileA, fileB }: DeepDiveProps) {
    const [explanation, setExplanation] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    // Works with 1 file (summary) or 2 files (connection analysis)
    const hasTwoFiles = fileA && fileB && fileA.path !== fileB.path;
    const hasOneFile = fileA || fileB;
    const canAnalyze = hasOneFile;
    const activeFile = fileB || fileA;

    const handleAnalyze = async () => {
        setLoading(true);
        setExplanation("");

        try {
            if (hasTwoFiles) {
                // Two-file connection analysis — try AI first
                const res = await fetch("/api/deep-dive", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fileA: { path: fileA.path, content: fileA.content.slice(0, 3000) },
                        fileB: { path: fileB.path, content: fileB.content.slice(0, 3000) },
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setExplanation(data.explanation);
                } else {
                    setExplanation(generateBasicExplanation(fileA, fileB));
                }
            } else if (activeFile) {
                // Single-file deep dive — use AI summary
                const res = await fetch("/api/summarize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: activeFile.content,
                        filename: activeFile.path,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const name = activeFile.path.split("/").pop();
                    setExplanation(
                        `🔍 **Deep Dive: ${name}**\n\n` +
                        `${data.summary}\n\n` +
                        (data.exports?.length > 0
                            ? `📤 **Exports (${data.exports.length}):** ${data.exports.slice(0, 10).join(", ")}${data.exports.length > 10 ? ` +${data.exports.length - 10} more` : ""}\n\n`
                            : "") +
                        (data.apiCalls?.length > 0
                            ? `🌐 **API Calls:** ${data.apiCalls.join(", ")}\n\n`
                            : "")
                    );
                } else {
                    setExplanation(`Summary unavailable. Try setting GROQ_API_KEY in .env.local.`);
                }
            }
        } catch {
            setExplanation("Failed to analyze. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!canAnalyze}
                    className="gap-2 border-[oklch(0.65_0.25_300/0.3)] text-[oklch(0.65_0.25_300)] hover:bg-[oklch(0.65_0.25_300/0.1)] hover:border-[oklch(0.65_0.25_300/0.5)] transition-all disabled:opacity-30"
                    onClick={() => {
                        setOpen(true);
                        handleAnalyze();
                    }}
                >
                    <Zap className="w-3.5 h-3.5" />
                    Deep Dive
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[oklch(0.65_0.25_300)]" />
                        {hasTwoFiles ? "Connection Analysis" : "File Deep Dive"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    {/* File badges */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                        {hasTwoFiles ? (
                            <>
                                <span className="font-mono bg-[oklch(0.82_0.16_195/0.1)] border border-[oklch(0.82_0.16_195/0.2)] px-2 py-1 rounded text-[oklch(0.82_0.16_195)]">
                                    {fileA?.path.split("/").pop()}
                                </span>
                                <span className="text-muted-foreground">↔</span>
                                <span className="font-mono bg-[oklch(0.65_0.25_300/0.1)] border border-[oklch(0.65_0.25_300/0.2)] px-2 py-1 rounded text-[oklch(0.65_0.25_300)]">
                                    {fileB?.path.split("/").pop()}
                                </span>
                            </>
                        ) : (
                            <span className="font-mono bg-[oklch(0.82_0.16_195/0.1)] border border-[oklch(0.82_0.16_195/0.2)] px-2 py-1 rounded text-[oklch(0.82_0.16_195)]">
                                {activeFile?.path.split("/").pop() || "—"}
                            </span>
                        )}
                    </div>

                    {/* Hint */}
                    {!hasTwoFiles && (
                        <p className="text-[10px] text-muted-foreground italic">
                            💡 Click a second file to compare two files&apos; relationships.
                        </p>
                    )}

                    {/* Explanation */}
                    <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] max-h-[400px] overflow-auto">
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-4/6" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        ) : explanation ? (
                            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {explanation}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                Analyzing...
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function generateBasicExplanation(
    fileA: { path: string; content: string },
    fileB: { path: string; content: string }
): string {
    const nameA = fileA.path.split("/").pop() || fileA.path;
    const nameB = fileB.path.split("/").pop() || fileB.path;

    const aImportsB =
        fileA.content.includes(fileB.path) ||
        fileA.content.includes(nameB.replace(/\.\w+$/, ""));
    const bImportsA =
        fileB.content.includes(fileA.path) ||
        fileB.content.includes(nameA.replace(/\.\w+$/, ""));

    const dirA = fileA.path.split("/").slice(0, -1).join("/");
    const dirB = fileB.path.split("/").slice(0, -1).join("/");
    const sameDir = dirA === dirB;

    let explanation = `🔍 **Analysis: ${nameA} ↔ ${nameB}**\n\n`;

    if (aImportsB && bImportsA) {
        explanation += `⚡ **Bidirectional dependency** — they import from each other.\n`;
        explanation += `  • Tightly coupled modules\n`;
        explanation += `  • Potential circular dependency risk\n\n`;
    } else if (aImportsB) {
        explanation += `→ **${nameA}** depends on **${nameB}**.\n\n`;
    } else if (bImportsA) {
        explanation += `← **${nameB}** depends on **${nameA}**.\n\n`;
    } else {
        explanation += `These files don't directly import each other.\nThey may be connected through intermediate modules.\n\n`;
    }

    if (sameDir) {
        explanation += `📁 Both files are in \`${dirA || "root"}\`, part of the same module.\n\n`;
    }

    const isApiA = /route\.(ts|js)$|controller|handler/i.test(fileA.path);
    const isApiB = /route\.(ts|js)$|controller|handler/i.test(fileB.path);
    const isServiceA = /service|util|helper|lib/i.test(fileA.path);
    const isServiceB = /service|util|helper|lib/i.test(fileB.path);

    if (isApiA && isServiceB) {
        explanation += `🏗️ **Pattern**: ${nameA} (API) → ${nameB} (Service). Controller-Service pattern.\n`;
    } else if (isApiB && isServiceA) {
        explanation += `🏗️ **Pattern**: ${nameB} (API) → ${nameA} (Service). Controller-Service pattern.\n`;
    }

    explanation += `\n💡 *Set GROQ_API_KEY in .env.local for AI-powered deep analysis.*`;
    return explanation;
}
