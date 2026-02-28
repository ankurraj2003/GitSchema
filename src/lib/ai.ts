// AI module — LLM integration for file summaries and Deep Dive explanations.
// Supports: Groq (default, fast + free), OpenAI, Anthropic.
// Falls back gracefully to regex-based analysis when no API key is configured.

export interface AiSummary {
    summary: string;
    exports: string[];
    apiCalls: string[];
}

// ─── Provider detection ──────────────────────────────────────────────
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

type Provider = "groq" | "openai" | "none";

function getProvider(): Provider {
    if (GROQ_KEY) return "groq";
    if (OPENAI_KEY) return "openai";
    return "none";
}

function getProviderConfig(): { baseUrl: string; apiKey: string; model: string } {
    const provider = getProvider();
    switch (provider) {
        case "groq":
            return {
                baseUrl: "https://api.groq.com/openai/v1",
                apiKey: GROQ_KEY,
                model: "llama-3.3-70b-versatile",
            };
        case "openai":
            return {
                baseUrl: "https://api.openai.com/v1",
                apiKey: OPENAI_KEY,
                model: "gpt-4o-mini",
            };
        default:
            return { baseUrl: "", apiKey: "", model: "" };
    }
}

// ─── Public API ──────────────────────────────────────────────────────
export async function summarizeFile(
    content: string,
    filename: string
): Promise<AiSummary> {
    if (getProvider() === "none") {
        return generateBasicSummary(content, filename);
    }

    try {
        return await callLLMJson(
            `Analyze this file "${filename}" and return a JSON object with:
- "summary": A 2-3 sentence description of what this file does
- "exports": Array of exported function/class names
- "apiCalls": Array of external API calls or HTTP requests made

File content:
\`\`\`
${content.slice(0, 4000)}
\`\`\``,
        );
    } catch (err) {
        console.error(`[AI] Summary failed for ${filename}:`, err);
        return generateBasicSummary(content, filename);
    }
}

export async function explainConnection(
    fileA: { path: string; content: string },
    fileB: { path: string; content: string }
): Promise<string> {
    if (getProvider() === "none") {
        return `**Connection Analysis** (AI unavailable)\n\nEnable AI by setting GROQ_API_KEY (free & fast) or OPENAI_API_KEY in .env.local.`;
    }

    try {
        return await callLLMText(
            `Explain how these two files relate to each other in a software architecture context. Be concise but insightful.

File A: ${fileA.path}
\`\`\`
${fileA.content.slice(0, 3000)}
\`\`\`

File B: ${fileB.path}
\`\`\`
${fileB.content.slice(0, 3000)}
\`\`\``
        );
    } catch {
        return "Failed to generate AI explanation. Please try again.";
    }
}

// ─── LLM call helpers (OpenAI-compatible, works for Groq + OpenAI) ──
async function callLLMJson(prompt: string): Promise<AiSummary> {
    const { baseUrl, apiKey, model } = getProviderConfig();

    const body: Record<string, unknown> = {
        model,
        messages: [
            { role: "system", content: "You are a code analysis assistant. Return valid JSON only." },
            { role: "user", content: prompt },
        ],
        max_tokens: 500,
    };

    // Groq supports JSON mode
    if (getProvider() === "groq" || getProvider() === "openai") {
        body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    try {
        return JSON.parse(text);
    } catch {
        return { summary: text, exports: [], apiCalls: [] };
    }
}

async function callLLMText(prompt: string): Promise<string> {
    const { baseUrl, apiKey, model } = getProviderConfig();

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: "You are a code analysis assistant." },
                { role: "user", content: prompt },
            ],
            max_tokens: 800,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "No analysis available.";
}

// ─── Regex-based fallback ───────────────────────────────────────────
function generateBasicSummary(content: string, filename: string): AiSummary {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const lines = content.split("\n");
    const lineCount = lines.length;

    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    const pyDefs: string[] = [];
    const pyDefRegex = /^(?:def|class)\s+(\w+)/gm;
    while ((match = pyDefRegex.exec(content)) !== null) {
        pyDefs.push(match[1]);
    }

    const apiCalls: string[] = [];
    const fetchRegex = /(?:fetch|axios|http|request)\s*\(\s*['"`]([^'"`]+)/g;
    while ((match = fetchRegex.exec(content)) !== null) {
        apiCalls.push(match[1]);
    }

    const langMap: Record<string, string> = {
        ts: "TypeScript", tsx: "React TypeScript", js: "JavaScript", jsx: "React JavaScript",
        py: "Python", go: "Go", rs: "Rust", java: "Java",
    };
    const lang = langMap[ext] || ext.toUpperCase();
    const allExports = [...exports, ...pyDefs];

    let summary = `A ${lang} file with ${lineCount} lines.`;
    if (allExports.length > 0) {
        summary += ` Defines: ${allExports.slice(0, 5).join(", ")}${allExports.length > 5 ? ` and ${allExports.length - 5} more` : ""}.`;
    }
    if (apiCalls.length > 0) {
        summary += ` Makes external API calls.`;
    }

    return { summary, exports: allExports, apiCalls };
}
