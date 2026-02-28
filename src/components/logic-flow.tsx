"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, AlertCircle } from "lucide-react";

interface LogicFlowProps {
    diagrams: Record<string, string>;
    selectedEndpoint: string | null;
}

mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
        primaryColor: "#1a1a2e",
        primaryTextColor: "#e0e0ff",
        primaryBorderColor: "#00d4ff",
        lineColor: "#00d4ff",
        secondaryColor: "#16213e",
        tertiaryColor: "#0f3460",
        actorBorder: "#00d4ff",
        actorBkg: "#1a1a2e",
        actorTextColor: "#e0e0ff",
        actorLineColor: "#00d4ff",
        signalColor: "#e0e0ff",
        signalTextColor: "#e0e0ff",
        labelBoxBkgColor: "#1a1a2e",
        labelBoxBorderColor: "#00d4ff",
        labelTextColor: "#e0e0ff",
        loopTextColor: "#e0e0ff",
        noteBorderColor: "#a855f7",
        noteBkgColor: "#16213e",
        noteTextColor: "#e0e0ff",
        sequenceNumberColor: "#00d4ff",
    },
    sequence: {
        diagramMarginX: 20,
        diagramMarginY: 20,
        actorMargin: 80,
        width: 180,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 40,
        mirrorActors: false,
        useMaxWidth: true,
    },
});

export default function LogicFlow({ diagrams, selectedEndpoint }: LogicFlowProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const endpoints = Object.keys(diagrams);

    useEffect(() => {
        const endpoint = selectedEndpoint || endpoints[0];
        if (!endpoint || !diagrams[endpoint]) return;

        setLoading(true);
        setError(null);

        const renderDiagram = async () => {
            try {
                if (containerRef.current) {
                    const id = `mermaid-${Date.now()}`;
                    const { svg } = await mermaid.render(id, diagrams[endpoint]);
                    if (containerRef.current) {
                        containerRef.current.innerHTML = svg;
                    }
                }
            } catch (err) {
                setError("Failed to render sequence diagram");
                console.error("Mermaid render error:", err);
            } finally {
                setLoading(false);
            }
        };

        renderDiagram();
    }, [selectedEndpoint, diagrams, endpoints]);

    if (endpoints.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <AlertCircle className="w-12 h-12 opacity-50" />
                <p className="text-lg">No API endpoints detected</p>
                <p className="text-sm opacity-70">
                    API routes are identified from common patterns like routes/, pages/api/, or controllers/
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-4 p-4">
            {/* Endpoint selector */}
            <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-[oklch(0.82_0.16_195)]" />
                        API Endpoints
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {endpoints.map((ep) => (
                            <Badge
                                key={ep}
                                variant={ep === (selectedEndpoint || endpoints[0]) ? "default" : "secondary"}
                                className="cursor-pointer transition-all hover:scale-105"
                            >
                                {ep.split("/").pop()}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Diagram */}
            <Card className="flex-1 bg-card/50 border-border overflow-auto">
                <CardContent className="p-4">
                    {loading && (
                        <div className="space-y-4">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-64 w-full" />
                        </div>
                    )}
                    {error && (
                        <div className="text-red-400 text-center py-8">{error}</div>
                    )}
                    <div
                        ref={containerRef}
                        className="flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
