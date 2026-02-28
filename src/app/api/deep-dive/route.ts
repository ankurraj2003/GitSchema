import { NextResponse } from "next/server";
import { explainConnection } from "@/lib/ai";

export async function POST(request: Request) {
    try {
        const { fileA, fileB } = await request.json();

        if (!fileA || !fileB) {
            return NextResponse.json(
                { error: "Both fileA and fileB are required" },
                { status: 400 }
            );
        }

        const explanation = await explainConnection(fileA, fileB);
        return NextResponse.json({ explanation });
    } catch (error: unknown) {
        console.error("Deep dive error:", error);
        return NextResponse.json(
            { error: "Failed to analyze connection" },
            { status: 500 }
        );
    }
}
