"""
AI module — LLM integration for file summaries and Deep Dive explanations.
Supports: Groq (default, fast + free), OpenAI.
Falls back gracefully to regex-based analysis when no API key is configured.
Port of src/lib/ai.ts
"""

import os
import re
import json
from typing import Optional

import httpx


# ─── Provider detection ─────────────────────────────────────────────

GROQ_KEY = os.getenv("GROQ_API_KEY", "")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


def _get_provider() -> str:
    if GROQ_KEY:
        return "groq"
    if OPENAI_KEY:
        return "openai"
    return "none"


def _get_provider_config() -> dict[str, str]:
    provider = _get_provider()
    if provider == "groq":
        return {
            "base_url": "https://api.groq.com/openai/v1",
            "api_key": GROQ_KEY,
            "model": "llama-3.3-70b-versatile",
        }
    elif provider == "openai":
        return {
            "base_url": "https://api.openai.com/v1",
            "api_key": OPENAI_KEY,
            "model": "gpt-4o-mini",
        }
    return {"base_url": "", "api_key": "", "model": ""}


# ─── Public API ─────────────────────────────────────────────────────

async def summarize_file(content: str, filename: str) -> dict:
    """Summarize a file using LLM or regex fallback."""
    if _get_provider() == "none":
        return _generate_basic_summary(content, filename)

    try:
        return await _call_llm_json(
            f'Analyze this file "{filename}" and return a JSON object with:\n'
            '- "summary": A 2-3 sentence description of what this file does\n'
            '- "exports": Array of exported function/class names\n'
            '- "apiCalls": Array of external API calls or HTTP requests made\n\n'
            f"File content:\n```\n{content[:4000]}\n```"
        )
    except Exception as err:
        print(f"[AI] Summary failed for {filename}: {err}")
        return _generate_basic_summary(content, filename)


async def explain_connection(
    file_a: dict[str, str],
    file_b: dict[str, str],
) -> str:
    """Explain how two files relate to each other."""
    if _get_provider() == "none":
        return (
            "**Connection Analysis** (AI unavailable)\n\n"
            "Enable AI by setting GROQ_API_KEY (free & fast) or OPENAI_API_KEY in .env."
        )

    try:
        return await _call_llm_text(
            "Explain how these two files relate to each other in a software architecture context. "
            "Be concise but insightful.\n\n"
            f"File A: {file_a['path']}\n```\n{file_a['content'][:3000]}\n```\n\n"
            f"File B: {file_b['path']}\n```\n{file_b['content'][:3000]}\n```"
        )
    except Exception:
        return "Failed to generate AI explanation. Please try again."


# ─── LLM call helpers (OpenAI-compatible, works for Groq + OpenAI) ──

async def _call_llm_json(prompt: str) -> dict:
    config = _get_provider_config()

    body: dict = {
        "model": config["model"],
        "messages": [
            {"role": "system", "content": "You are a code analysis assistant. Return valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 500,
    }

    provider = _get_provider()
    if provider in ("groq", "openai"):
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{config['base_url']}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config['api_key']}",
            },
            json=body,
            timeout=30.0,
        )

    if resp.status_code != 200:
        raise Exception(f"LLM API error ({resp.status_code}): {resp.text}")

    data = resp.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"summary": text, "exports": [], "apiCalls": []}


async def _call_llm_text(prompt: str) -> str:
    config = _get_provider_config()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{config['base_url']}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config['api_key']}",
            },
            json={
                "model": config["model"],
                "messages": [
                    {"role": "system", "content": "You are a code analysis assistant."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 800,
            },
            timeout=30.0,
        )

    if resp.status_code != 200:
        raise Exception(f"LLM API error ({resp.status_code}): {resp.text}")

    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "No analysis available.")


# ─── Regex-based fallback ───────────────────────────────────────────

def _generate_basic_summary(content: str, filename: str) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    lines = content.split("\n")
    line_count = len(lines)

    exports: list[str] = []
    # JS/TS exports
    for m in re.finditer(
        r"export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)",
        content,
    ):
        exports.append(m.group(1))

    # Python defs/classes
    py_defs: list[str] = []
    for m in re.finditer(r"^(?:def|class)\s+(\w+)", content, re.MULTILINE):
        py_defs.append(m.group(1))

    api_calls: list[str] = []
    for m in re.finditer(r"(?:fetch|axios|http|request)\s*\(\s*['\"`]([^'\"`]+)", content):
        api_calls.append(m.group(1))

    lang_map = {
        "ts": "TypeScript", "tsx": "React TypeScript",
        "js": "JavaScript", "jsx": "React JavaScript",
        "py": "Python", "go": "Go", "rs": "Rust", "java": "Java",
    }
    lang = lang_map.get(ext, ext.upper())
    all_exports = exports + py_defs

    summary = f"A {lang} file with {line_count} lines."
    if all_exports:
        shown = ", ".join(all_exports[:5])
        extra = f" and {len(all_exports) - 5} more" if len(all_exports) > 5 else ""
        summary += f" Defines: {shown}{extra}."
    if api_calls:
        summary += " Makes external API calls."

    return {"summary": summary, "exports": all_exports, "apiCalls": api_calls}
