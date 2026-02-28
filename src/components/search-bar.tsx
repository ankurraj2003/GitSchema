"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Github } from "lucide-react";

interface SearchBarProps {
    onSubmit: (url: string) => void;
    loading?: boolean;
}

export default function SearchBar({ onSubmit, loading }: SearchBarProps) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!url.trim()) {
            setError("Please enter a GitHub URL");
            return;
        }

        const githubRegex = /github\.com\/[^/]+\/[^/\s?#]+/;
        const shortRegex = /^[^/]+\/[^/\s?#]+$/;
        if (!githubRegex.test(url) && !shortRegex.test(url)) {
            setError("Please enter a valid GitHub URL (e.g., github.com/owner/repo)");
            return;
        }

        onSubmit(url.trim());
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
            <div className="relative group">
                {/* Glow border effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[oklch(0.82_0.16_195)] via-[oklch(0.65_0.25_300)] to-[oklch(0.82_0.16_195)] rounded-xl opacity-30 group-hover:opacity-50 blur-sm transition-opacity duration-500" />

                <div className="relative flex items-center gap-2 bg-[oklch(0.1_0.015_260)] border border-[oklch(0.25_0.03_260)] rounded-xl p-1.5">
                    <div className="flex items-center gap-2 pl-3 text-muted-foreground">
                        <Github className="w-5 h-5" />
                    </div>

                    <Input
                        type="text"
                        placeholder="Paste a GitHub URL...."
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            setError("");
                        }}
                        className="flex-1 border-0 bg-transparent text-base placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 h-11"
                        disabled={loading}
                    />

                    <Button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="h-10 px-5 bg-gradient-to-r from-[oklch(0.82_0.16_195)] to-[oklch(0.65_0.25_300)] text-[oklch(0.1_0.02_260)] font-semibold rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-30"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Search className="w-4 h-4 mr-2" />
                                Analyze
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {error && (
                <p className="text-red-400 text-sm mt-2 text-center animate-fade-in-up">
                    {error}
                </p>
            )}
        </form>
    );
}
