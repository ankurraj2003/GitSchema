"use client";

import { useState } from "react";
import SearchBar from "@/components/search-bar";
import Dashboard from "@/components/dashboard";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Eye, Network, Sparkles, Zap, Github } from "lucide-react";
import Image from "next/image";

interface RepoData {
  meta: {
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
  };
  nodes: any[];
  edges: any[];
  fileContents: Record<string, string>;
  erdDiagram: string;
  logicFlows: Record<string, string>;
  stats: {
    totalFiles: number;
    totalFolders: number;
    parsedFiles: number;
    apiEndpoints: number;
    schemaFiles: number;
  };
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [repoUrl, setRepoUrl] = useState("");

  const handleSubmit = async (url: string) => {
    setLoading(true);
    setError(null);
    setRepoUrl(url);

    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze repository");
      }

      setRepoData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRepoData(null);
    setRepoUrl("");
    setError(null);
  };

  // ─── Dashboard View ──────────────────────────────────────────────
  if (repoData) {
    return (
      <Dashboard
        meta={repoData.meta}
        nodes={repoData.nodes}
        edges={repoData.edges}
        fileContents={repoData.fileContents}
        erdDiagram={repoData.erdDiagram}
        logicFlows={repoData.logicFlows}
        stats={repoData.stats}
        repoUrl={`https://github.com/${repoData.meta.fullName}`}
        onBack={handleBack}
      />
    );
  }

  // ─── Loading View ────────────────────────────────────────────────
  if (loading) {
    return <LoadingSkeleton />;
  }

  // ─── Hero View ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="h-14 border-b border-border/50 flex items-center px-6 backdrop-blur-md bg-background/30">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="GitSchema" width={28} height={28} className="object-contain" />
          <span className="font-bold text-lg tracking-tight">
            Git<span className="text-[oklch(0.82_0.16_195)]">Schema</span>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://github.com/ankurraj2003/GitSchema"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="text-center max-w-3xl mx-auto space-y-6 animate-fade-in-up">


          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            See Your Code
            <br />
            <span className="bg-gradient-to-r from-[oklch(0.82_0.16_195)] via-[oklch(0.7_0.2_240)] to-[oklch(0.65_0.25_300)] bg-clip-text text-transparent">
              Like Never Before
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Paste any public GitHub repository URL and instantly visualize its architecture,
            file dependencies, and API flow in an interactive map.
          </p>

          {/* Search Bar */}
          <div className="pt-4">
            <SearchBar onSubmit={handleSubmit} loading={loading} />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in-up">
              {error}
            </div>
          )}
        </div>
      </main>


    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div
      className="group p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm hover:border-border hover:bg-card/50 transition-all duration-300"
      style={{ ["--feature-color" as string]: color }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
        style={{ backgroundColor: `color-mix(in oklch, ${color}, transparent 90%)`, color }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
