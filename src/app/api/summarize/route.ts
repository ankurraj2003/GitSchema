import { NextResponse } from "next/server";
import { summarizeFile } from "@/lib/ai";
import { summaryCache, contentHash } from "@/lib/cache";

export async function POST(request: Request) {
    try {
        const { content, filename } = await request.json();

        if (!content || !filename) {
            return NextResponse.json(
                { error: "content and filename are required" },
                { status: 400 }
            );
        }

        // Check cache using content hash
        const hash = contentHash(content);
        const cached = summaryCache.get(hash);
        if (cached) {
            console.log(`[CACHE HIT] summary: ${filename}`);
            return NextResponse.json(cached);
        }

        const summary = await summarizeFile(content, filename);

        // Store in cache
        summaryCache.set(hash, summary);
        console.log(`[CACHE SET] summary: ${filename}`);

        return NextResponse.json(summary);
    } catch (error: unknown) {
        console.error("AI summary error:", error);
        return NextResponse.json(
            { error: "Failed to generate summary" },
            { status: 500 }
        );
    }
}
