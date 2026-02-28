"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { AlertCircle, Database } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SchemaViewProps {
    erdDiagram: string;
}

export default function SchemaView({ erdDiagram }: SchemaViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!erdDiagram) return;

        setLoading(true);
        setError(null);

        const renderDiagram = async () => {
            try {
                if (containerRef.current) {
                    const id = `mermaid-erd-${Date.now()}`;
                    const { svg } = await mermaid.render(id, erdDiagram);
                    if (containerRef.current) {
                        containerRef.current.innerHTML = svg;
                    }
                }
            } catch (err) {
                setError("Failed to render ERD diagram");
                console.error("Mermaid ERD error:", err);
            } finally {
                setLoading(false);
            }
        };

        renderDiagram();
    }, [erdDiagram]);

    if (!erdDiagram) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <Database className="w-12 h-12 opacity-50" />
                <p className="text-lg">No Schema Files Detected</p>
                <p className="text-sm opacity-70">
                    Supported schemas: schema.prisma, *.sql, models.py
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-6">
            {loading && (
                <div className="space-y-4 w-full max-w-2xl">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}
            <div
                ref={containerRef}
                className="w-full overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
            />
        </div>
    );
}
