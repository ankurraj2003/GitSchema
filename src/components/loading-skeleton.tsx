"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function LoadingSkeleton() {
    return (
        <div className="flex h-[calc(100vh-4rem)] animate-fade-in-up">
            {/* Left sidebar skeleton — hidden on mobile */}
            <div className="hidden md:block w-64 border-r border-border p-4 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="space-y-2 mt-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Center canvas skeleton */}
            <div className="flex-1 p-3 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-32 rounded-lg" />
                        <Skeleton className="h-9 w-28 rounded-lg" />
                        <Skeleton className="h-9 w-28 rounded-lg" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                    </div>
                </div>

                <Card className="h-[calc(100%-3rem)] bg-card/30 border-border flex items-center justify-center relative overflow-hidden">
                    {/* Fake nodes */}
                    <div className="absolute inset-0 p-10">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className="absolute rounded-lg"
                                style={{
                                    width: `${100 + Math.random() * 80}px`,
                                    height: "40px",
                                    left: `${15 + (i % 4) * 22}%`,
                                    top: `${10 + Math.floor(i / 4) * 40 + (i % 2) * 15}%`,
                                }}
                            />
                        ))}
                        {/* Fake edges */}
                        <svg className="absolute inset-0 w-full h-full opacity-20">
                            <line x1="20%" y1="20%" x2="40%" y2="30%" stroke="oklch(0.82 0.16 195)" strokeWidth="1" />
                            <line x1="40%" y1="30%" x2="60%" y2="25%" stroke="oklch(0.82 0.16 195)" strokeWidth="1" />
                            <line x1="60%" y1="25%" x2="80%" y2="40%" stroke="oklch(0.65 0.25 300)" strokeWidth="1" />
                            <line x1="25%" y1="60%" x2="45%" y2="65%" stroke="oklch(0.82 0.16 195)" strokeWidth="1" />
                            <line x1="45%" y1="65%" x2="70%" y2="70%" stroke="oklch(0.82 0.16 195)" strokeWidth="1" />
                        </svg>
                    </div>

                    {/* Loading indicator */}
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-2 border-[oklch(0.82_0.16_195/0.3)] rounded-full" />
                            <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-[oklch(0.82_0.16_195)] rounded-full animate-spin" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Analyzing Repository</p>
                            <p className="text-xs text-muted-foreground mt-1">Fetching files and parsing dependencies...</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
