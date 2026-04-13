import os
import time
import asyncio
from typing import Any

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from github_client import (
    parse_github_url,
    fetch_repo_meta,
    fetch_repo_tree,
    fetch_file_content,
    detect_primary_language,
)
from code_parser import (
    tree_to_graph,
    build_dependency_edges,
    parse_imports,
    parse_exports,
    detect_api_methods,
    is_api_file,
    classify_node_role,
    detect_external_apis,
    trace_function_calls,
    generate_architecture_mermaid,
    generate_sequence_mermaid,
)
from schema_parser import (
    detect_schema_files,
    parse_prisma_schema,
    parse_sql_schema,
    entities_to_mermaid_erd,
)
from ai_module import summarize_file, explain_connection
from cache_module import repo_cache, summary_cache, content_hash, get_cache_stats

# ─── App Setup ──────────────────────────────────────────────────────

app = FastAPI(title="GitSchema API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request Models ─────────────────────────────────────────────────

class GitHubRequest(BaseModel):
    url: str


class DeepDiveRequest(BaseModel):
    fileA: dict[str, str]
    fileB: dict[str, str]


class SummarizeRequest(BaseModel):
    content: str
    filename: str


# ─── POST /api/github ───────────────────────────────────────────────

@app.post("/api/github")
async def analyze_repo(req: GitHubRequest) -> dict[str, Any]:
    """Analyze a GitHub repository and return its structure, dependencies, and diagrams."""
    if not req.url:
        raise HTTPException(status_code=400, detail="URL is required")

    parsed = parse_github_url(req.url)
    if not parsed:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub URL. Expected format: github.com/owner/repo",
        )

    owner, repo = parsed["owner"], parsed["repo"]
    cache_key = f"{owner}/{repo}"

    # ─── Check full repo cache ──────────────────────────────────
    cached = repo_cache.get(cache_key)
    if cached is not None:
        print(f"[CACHE HIT] Full repo analysis: {cache_key}")
        print(f"[CACHE STATS] {get_cache_stats()}")
        return cached

    print(f"[CACHE MISS] Analyzing: {cache_key}")
    start_time = time.time()

    try:
        # ─── Step 1: Fetch repo metadata and file tree ──────────
        meta, tree = await asyncio.gather(
            fetch_repo_meta(owner, repo),
            fetch_repo_tree(owner, repo, "HEAD"),
        )

        language = meta.get("language") or detect_primary_language(tree)

        # ─── Step 2: Build Level 1 — File tree graph ────────────
        graph = tree_to_graph(tree)
        nodes = graph["nodes"]
        edges = graph["edges"]

        # ─── Step 3: Identify parseable files ───────────────────
        parseable_exts = {"ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "rb"}
        parseable_files = [
            item for item in tree
            if item["type"] == "blob"
            and item["path"].rsplit(".", 1)[-1].lower() in parseable_exts
        ][:60]

        # ─── Step 4: Fetch file contents ────────────────────────
        file_contents: dict[str, str] = {}
        batch_size = 10
        for i in range(0, len(parseable_files), batch_size):
            batch = parseable_files[i:i + batch_size]
            results = await asyncio.gather(*[
                fetch_file_content(owner, repo, f["path"])
                for f in batch
            ])
            for f, content in zip(batch, results):
                if content:
                    file_contents[f["path"]] = content

        # ─── Step 5: Build Level 2 — Dependency edges ───────────
        dep_edges = build_dependency_edges(file_contents, nodes)

        # ─── Step 6: Enhance nodes with parsed data ─────────────
        for node in nodes:
            content = file_contents.get(node["data"]["path"])
            if content:
                node["data"]["role"] = classify_node_role(node["data"]["path"], content)
                is_api = node["data"]["role"] in ("api", "controller")
                if is_api:
                    node["data"]["type"] = "api"
                    node["type"] = "apiNode"

                node["data"]["imports"] = parse_imports(content, node["data"]["path"])
                node["data"]["exports"] = parse_exports(content)
                node["data"]["externalApis"] = detect_external_apis(content)
                node["data"]["functionCalls"] = trace_function_calls(
                    content, node["data"]["path"], node["data"]["imports"]
                )

                if is_api_file(node["data"]["path"]):
                    node["data"]["apiMethods"] = detect_api_methods(content)

        # ─── Step 7: Detect schema files and build ERD ──────────
        schema_paths = detect_schema_files([t["path"] for t in tree])
        erd_diagram = ""
        for schema_path in schema_paths:
            content = file_contents.get(schema_path) or await fetch_file_content(
                owner, repo, schema_path
            )
            if content:
                entities = None
                if schema_path.endswith(".prisma"):
                    entities = parse_prisma_schema(content)
                elif schema_path.endswith(".sql"):
                    entities = parse_sql_schema(content)

                if entities:
                    erd_diagram = entities_to_mermaid_erd(entities)
                    break

        # ─── Step 8: Generate Mermaid diagrams ──────────────────
        all_edges = edges + dep_edges

        architecture_mermaid = generate_architecture_mermaid(nodes, all_edges)

        api_nodes = [n for n in nodes if n["data"]["type"] == "api"]
        logic_flows: dict[str, str] = {}
        for api_node in api_nodes:
            logic_flows[api_node["data"]["path"]] = generate_sequence_mermaid(
                api_node, nodes, all_edges
            )

        # ─── Step 9: Generate repo summary ──────────────────────
        entry_points = [n for n in nodes if n["data"]["role"] == "entry"]
        controllers = [n for n in nodes if n["data"]["role"] in ("api", "controller")]
        services = [n for n in nodes if n["data"]["role"] == "service"]
        models = [n for n in nodes if n["data"]["role"] == "model"]

        all_external_apis: set[str] = set()
        for node in nodes:
            for api in node["data"].get("externalApis", []):
                all_external_apis.add(api)

        total_files = sum(1 for t in tree if t["type"] == "blob")
        summary = (
            f"A {language} repository with {total_files} files. "
            f"Architecture: {len(entry_points)} entry point(s), {len(controllers)} API route(s), "
            f"{len(services)} service(s), {len(models)} model(s)."
        )
        if all_external_apis:
            apis_str = ", ".join(list(all_external_apis)[:5])
            summary += f" External integrations: {apis_str}."

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"[ANALYSIS COMPLETE] {cache_key} in {elapsed_ms}ms")

        # ─── Build response ─────────────────────────────────────
        result: dict[str, Any] = {
            "summary": summary,
            "meta": {**meta, "language": language},
            "nodes": nodes,
            "edges": all_edges,
            "fileContents": file_contents,
            "erdDiagram": erd_diagram,
            "logicFlows": logic_flows,
            "mermaid": {
                "flow": architecture_mermaid,
                "sequence": list(logic_flows.values())[0] if logic_flows else "",
            },
            "stats": {
                "totalFiles": total_files,
                "totalFolders": sum(1 for t in tree if t["type"] == "tree"),
                "parsedFiles": len(file_contents),
                "apiEndpoints": len(api_nodes),
                "schemaFiles": len(schema_paths),
                "entryPoints": len(entry_points),
                "services": len(services),
                "models": len(models),
                "externalApis": len(all_external_apis),
                "analysisTimeMs": elapsed_ms,
                "cached": False,
            },
        }

        # ─── Store in cache ─────────────────────────────────────
        cached_result = {**result, "stats": {**result["stats"], "cached": True}}
        repo_cache[cache_key] = cached_result
        print(f"[CACHE SET] {cache_key}")
        print(f"[CACHE STATS] {get_cache_stats()}")

        return result

    except HTTPException:
        raise
    except Exception as error:
        print(f"GitHub API error: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# ─── POST /api/deep-dive ───────────────────────────────────────────

@app.post("/api/deep-dive")
async def deep_dive(req: DeepDiveRequest) -> dict[str, str]:
    """Analyze the connection between two files."""
    if not req.fileA or not req.fileB:
        raise HTTPException(status_code=400, detail="Both fileA and fileB are required")

    try:
        explanation = await explain_connection(req.fileA, req.fileB)
        return {"explanation": explanation}
    except Exception as error:
        print(f"Deep dive error: {error}")
        raise HTTPException(status_code=500, detail="Failed to analyze connection")


# ─── POST /api/summarize ───────────────────────────────────────────

@app.post("/api/summarize")
async def summarize(req: SummarizeRequest) -> dict:
    """Generate an AI summary for a file."""
    if not req.content or not req.filename:
        raise HTTPException(status_code=400, detail="content and filename are required")

    try:
        # Check cache
        h = content_hash(req.content)
        cached = summary_cache.get(h)
        if cached is not None:
            print(f"[CACHE HIT] summary: {req.filename}")
            return cached

        result = await summarize_file(req.content, req.filename)

        # Store in cache
        summary_cache[h] = result
        print(f"[CACHE SET] summary: {req.filename}")

        return result
    except Exception as error:
        print(f"AI summary error: {error}")
        raise HTTPException(status_code=500, detail="Failed to generate summary")


# ─── Health check ───────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "cache": get_cache_stats()}
