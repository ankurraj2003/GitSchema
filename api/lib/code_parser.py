"""
Parser module — File tree to graph, import/export parsing, Mermaid diagram generation,
dependency edge construction, and graph layout.
Port of src/lib/parser.ts (~563 lines)
"""

import re
from typing import Optional

import networkx as nx


# ─── Types ──────────────────────────────────────────────────────────

NodeRole = str  # "entry" | "controller" | "service" | "model" | "util" | "config" | "test" | "api" | "file" | "folder"


def _make_node(
    node_id: str,
    node_type: str,
    label: str,
    path: str,
    data_type: str,
    role: NodeRole,
    position: Optional[dict] = None,
    **extra_data,
) -> dict:
    """Create a graph node compatible with the React Flow format."""
    data = {
        "label": label,
        "path": path,
        "type": data_type,
        "role": role,
        **extra_data,
    }
    return {
        "id": node_id,
        "type": node_type,
        "position": position or {"x": 0, "y": 0},
        "data": data,
    }


def _make_edge(
    edge_id: str,
    source: str,
    target: str,
    edge_type: str = "smoothstep",
    animated: bool = False,
    style: Optional[dict] = None,
    data: Optional[dict] = None,
    label: Optional[str] = None,
) -> dict:
    """Create a graph edge compatible with the React Flow format."""
    edge: dict = {
        "id": edge_id,
        "source": source,
        "target": target,
        "type": edge_type,
        "animated": animated,
        "style": style or {"stroke": "oklch(0.4 0.02 260)", "strokeWidth": 1},
        "data": data or {"type": "tree"},
    }
    if label is not None:
        edge["label"] = label
    return edge


# ─── Node Role Classification ────────────────────────────────────────

def classify_node_role(path: str, content: Optional[str] = None) -> NodeRole:
    """Classify a file's role based on its path and optionally its content."""
    lower = path.lower()

    # Entry points
    if re.match(r"^(server|app|main|index)\.(ts|js|py|go|rs)$", lower):
        return "entry"
    if re.match(r"^src/(server|app|main|index)\.(ts|js)$", lower):
        return "entry"

    # API / Controllers
    if re.search(r"app/api/.*/route\.(ts|js)$", lower):
        return "api"
    if re.search(r"pages/api/", lower):
        return "api"
    if re.search(r"controllers?/", lower):
        return "controller"
    if re.search(r"routes?/", lower):
        return "controller"
    if re.search(r"endpoints?/", lower):
        return "controller"

    # If content has router/app HTTP methods
    if content:
        if re.search(r"(?:router|app)\.(get|post|put|delete)\s*\(", content, re.IGNORECASE):
            return "controller"
        if re.search(r"@(?:app|router)\.(get|post|put|delete)\s*\(", content, re.IGNORECASE):
            return "controller"
        if re.search(r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b", content):
            return "api"

    # Services
    if re.search(r"services?/", lower):
        return "service"
    if re.search(r"providers?/", lower):
        return "service"
    if re.search(r"use[A-Z]\w+\.(ts|js)$", path):
        return "service"

    # Models / Database
    if re.search(r"models?/", lower):
        return "model"
    if re.search(r"schema", lower):
        return "model"
    if re.search(r"migrations?/", lower):
        return "model"
    if re.search(r"entities?/", lower):
        return "model"
    if re.search(r"prisma", lower):
        return "model"

    # Utils / Helpers
    if re.search(r"utils?/", lower):
        return "util"
    if re.search(r"helpers?/", lower):
        return "util"
    if re.search(r"lib/", lower):
        return "util"
    if re.search(r"common/", lower):
        return "util"

    # Config
    if re.search(r"config", lower):
        return "config"
    if re.search(r"\.env", lower):
        return "config"
    if re.search(r"settings", lower):
        return "config"

    # Tests
    if re.search(r"\.(test|spec)\.(ts|js|tsx|jsx)$", lower):
        return "test"
    if re.search(r"tests?/", lower):
        return "test"
    if re.search(r"__tests__/", lower):
        return "test"

    return "file"


# ─── External API Detection ─────────────────────────────────────────

def detect_external_apis(content: str) -> list[str]:
    """Detect external APIs referenced in file content."""
    apis: list[str] = []

    # fetch / axios calls with URLs
    for m in re.finditer(
        r"(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*[`'\"](https?://[^'\"`\s]+)",
        content,
    ):
        apis.append(m.group(1))

    # Template literal URLs
    for m in re.finditer(r"(?:fetch|axios)\s*\(\s*`([^`]*\$\{[^`]*)`", content):
        apis.append(re.sub(r"\$\{[^}]+\}", "{...}", m.group(1)))

    # SDK patterns
    sdk_patterns: list[tuple[re.Pattern, str]] = [
        (re.compile(r"stripe", re.IGNORECASE), "Stripe API"),
        (re.compile(r"firebase", re.IGNORECASE), "Firebase"),
        (re.compile(r"aws-sdk|@aws-sdk", re.IGNORECASE), "AWS SDK"),
        (re.compile(r"supabase", re.IGNORECASE), "Supabase"),
        (re.compile(r"prisma", re.IGNORECASE), "Prisma ORM"),
        (re.compile(r"mongoose|mongodb", re.IGNORECASE), "MongoDB"),
        (re.compile(r"pg|postgres", re.IGNORECASE), "PostgreSQL"),
        (re.compile(r"redis", re.IGNORECASE), "Redis"),
        (re.compile(r"sendgrid|@sendgrid", re.IGNORECASE), "SendGrid"),
        (re.compile(r"twilio", re.IGNORECASE), "Twilio"),
        (re.compile(r"openai", re.IGNORECASE), "OpenAI API"),
        (re.compile(r"anthropic", re.IGNORECASE), "Anthropic API"),
        (re.compile(r"googleapis|@google-cloud", re.IGNORECASE), "Google Cloud"),
    ]

    for pattern, name in sdk_patterns:
        if pattern.search(content):
            apis.append(name)

    return list(dict.fromkeys(apis))  # unique, preserving order


# ─── Function Call Tracing ──────────────────────────────────────────

def trace_function_calls(
    content: str,
    file_path: str,
    imports: list[str],
) -> list[dict]:
    """Trace function calls to imported modules."""
    calls: dict[str, set[str]] = {}

    # For each imported module, find function calls
    for imp in imports:
        module_name = imp.rsplit("/", 1)[-1]
        module_name = re.sub(r"\.\w+$", "", module_name)
        call_regex = re.compile(rf"{re.escape(module_name)}\.(\w+)\s*\(")
        for m in call_regex.finditer(content):
            calls.setdefault(imp, set()).add(m.group(1))

    # Also detect named import usage
    for m in re.finditer(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]", content):
        names = [n.strip().split(" as ")[0].strip() for n in m.group(1).split(",")]
        source = m.group(2)
        if source.startswith("."):
            for name in names:
                if re.search(rf"\b{re.escape(name)}\s*\(", content):
                    resolved = next(
                        (i for i in imports if source.lstrip("./") in i),
                        source,
                    )
                    calls.setdefault(resolved, set()).add(name)

    return [
        {"target": target, "functions": list(fns)}
        for target, fns in calls.items()
    ]


# ─── Mermaid Diagram Generation ─────────────────────────────────────

def _sanitize_mermaid_id(node_id: str) -> str:
    """Sanitize a string for use as a Mermaid node ID."""
    result = re.sub(r"[^a-zA-Z0-9_]", "_", node_id)
    return result.strip("_")


def generate_architecture_mermaid(nodes: list[dict], edges: list[dict]) -> str:
    """Generate a Mermaid flowchart of the architecture."""
    import_edges = [
        e for e in edges
        if e.get("data", {}).get("type") in ("import", "call")
    ]
    if not import_edges:
        return ""

    connected_ids: set[str] = set()
    for edge in import_edges:
        connected_ids.add(edge["source"])
        connected_ids.add(edge["target"])

    role_style = {
        "entry": ":::entry",
        "controller": ":::controller",
        "api": ":::api",
        "service": ":::service",
        "model": ":::model",
        "util": ":::util",
    }

    diagram = "graph TD\n"
    diagram += "    classDef entry fill:#22c55e,stroke:#16a34a,color:#fff\n"
    diagram += "    classDef controller fill:#3b82f6,stroke:#2563eb,color:#fff\n"
    diagram += "    classDef api fill:#a855f7,stroke:#9333ea,color:#fff\n"
    diagram += "    classDef service fill:#06b6d4,stroke:#0891b2,color:#fff\n"
    diagram += "    classDef model fill:#f97316,stroke:#ea580c,color:#fff\n"
    diagram += "    classDef util fill:#6b7280,stroke:#4b5563,color:#fff\n"

    for node in nodes:
        if node["id"] not in connected_ids:
            continue
        label = node["data"]["label"]
        style = role_style.get(node["data"]["role"], "")
        diagram += f'    {_sanitize_mermaid_id(node["id"])}["{label}"]{style}\n'

    for edge in import_edges:
        if edge["source"] not in connected_ids or edge["target"] not in connected_ids:
            continue
        label = edge.get("data", {}).get("label", "imports")
        diagram += f'    {_sanitize_mermaid_id(edge["source"])} -->|{label}| {_sanitize_mermaid_id(edge["target"])}\n'

    return diagram


def generate_sequence_mermaid(
    api_node: dict,
    all_nodes: list[dict],
    edges: list[dict],
) -> str:
    """Generate a Mermaid sequence diagram for an API endpoint."""
    methods = ", ".join(api_node["data"].get("apiMethods", [])) or "Request"
    label = api_node["data"]["label"]

    # Find direct dependencies
    direct_deps = []
    for e in edges:
        if e["source"] == api_node["id"] and e.get("data", {}).get("type") in ("import", "call"):
            dep_node = next((n for n in all_nodes if n["id"] == e["target"]), None)
            if dep_node:
                direct_deps.append(dep_node)

    services = [n for n in direct_deps if n["data"]["role"] in ("service", "util")]
    models = [n for n in direct_deps if n["data"]["role"] == "model"]

    san_label = _sanitize_mermaid_id(label)

    seq = "sequenceDiagram\n"
    seq += "    participant Client\n"
    seq += f"    participant {san_label} as {label}\n"

    for svc in services[:3]:
        san_svc = _sanitize_mermaid_id(svc["data"]["label"])
        seq += f"    participant {san_svc} as {svc['data']['label']}\n"
    for mdl in models[:2]:
        san_mdl = _sanitize_mermaid_id(mdl["data"]["label"])
        seq += f"    participant {san_mdl} as {mdl['data']['label']}\n"

    seq += f"    Client->>+{san_label}: {methods} Request\n"

    for svc in services[:3]:
        san_svc = _sanitize_mermaid_id(svc["data"]["label"])
        # Find function calls to this service
        fn_calls = api_node["data"].get("functionCalls") or []
        fns_str = "process"
        for fc in fn_calls:
            if svc["data"]["path"] in fc.get("target", ""):
                fns_str = ", ".join(fc["functions"][:2])
                break
        seq += f"    {san_label}->>+{san_svc}: {fns_str}()\n"

        for mdl in models[:2]:
            san_mdl = _sanitize_mermaid_id(mdl["data"]["label"])
            seq += f"    {san_svc}->>+{san_mdl}: query\n"
            seq += f"    {san_mdl}-->>-{san_svc}: data\n"

        seq += f"    {san_svc}-->>-{san_label}: result\n"

    seq += f"    {san_label}-->>-Client: Response\n"
    return seq


# ─── Level 1: File Tree → Graph ──────────────────────────────────────

def _ext_to_language(ext: str) -> str:
    """Map file extension to language name."""
    lang_map = {
        "ts": "TypeScript", "tsx": "TypeScript",
        "js": "JavaScript", "jsx": "JavaScript",
        "py": "Python", "go": "Go", "rs": "Rust",
        "java": "Java", "rb": "Ruby", "php": "PHP",
        "json": "JSON", "yaml": "YAML", "yml": "YAML",
        "md": "Markdown", "css": "CSS", "scss": "SCSS",
        "html": "HTML", "sql": "SQL", "prisma": "Prisma",
        "toml": "TOML", "xml": "XML", "sh": "Shell",
    }
    return lang_map.get(ext, ext.upper())


def tree_to_graph(tree: list[dict]) -> dict:
    """Convert a GitHub file tree into nodes and edges for React Flow."""
    nodes: list[dict] = []
    edges: list[dict] = []
    folder_set: set[str] = set()

    for item in tree:
        parts = item["path"].split("/")
        for i in range(1, len(parts)):
            folder_set.add("/".join(parts[:i]))

    sorted_folders = sorted(folder_set)
    for folder in sorted_folders:
        label = folder.rsplit("/", 1)[-1]
        nodes.append(_make_node(
            node_id=folder,
            node_type="folderNode",
            label=label,
            path=folder,
            data_type="folder",
            role="folder",
        ))

        parent_parts = folder.split("/")
        if len(parent_parts) > 1:
            parent = "/".join(parent_parts[:-1])
            edges.append(_make_edge(
                edge_id=f"{parent}->{folder}",
                source=parent,
                target=folder,
            ))

    file_items = [item for item in tree if item["type"] == "blob"]
    for item in file_items:
        label = item["path"].rsplit("/", 1)[-1]
        ext = label.rsplit(".", 1)[-1].lower() if "." in label else ""
        role = classify_node_role(item["path"])
        is_api = role in ("api", "controller")

        nodes.append(_make_node(
            node_id=item["path"],
            node_type="apiNode" if is_api else "fileNode",
            label=label,
            path=item["path"],
            data_type="api" if is_api else "file",
            role=role,
            language=_ext_to_language(ext),
            size=item.get("size"),
        ))

        parts = item["path"].split("/")
        if len(parts) > 1:
            parent = "/".join(parts[:-1])
            edges.append(_make_edge(
                edge_id=f"{parent}->{item['path']}",
                source=parent,
                target=item["path"],
            ))

    nodes = layout_graph(nodes, edges)
    return {"nodes": nodes, "edges": edges}


# ─── Level 2: Import Parsing ────────────────────────────────────────

def parse_imports(content: str, file_path: str) -> list[str]:
    """Parse import statements from file content."""
    imports: list[str] = []
    dir_path = "/".join(file_path.split("/")[:-1])

    # JS/TS imports and requires
    for m in re.finditer(
        r"(?:import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]|require\s*\(\s*['\"]([^'\"]+)['\"]\s*\))",
        content,
    ):
        import_path = m.group(1) or m.group(2)
        if import_path.startswith("."):
            resolved = _resolve_path(dir_path, import_path)
            imports.append(resolved)

    # Python from-imports
    for m in re.finditer(r"from\s+(\.\S+)\s+import", content):
        mod_path = m.group(1).replace(".", "/").lstrip("/")
        resolved = _resolve_path(dir_path, "./" + mod_path)
        imports.append(resolved)

    return list(dict.fromkeys(imports))  # unique


def parse_exports(content: str) -> list[str]:
    """Parse exported symbols from file content."""
    exports: list[str] = []

    for m in re.finditer(
        r"export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)",
        content,
    ):
        exports.append(m.group(1))

    for m in re.finditer(r"^(?:def|class)\s+(\w+)", content, re.MULTILINE):
        exports.append(m.group(1))

    return exports


def build_dependency_edges(
    file_contents: dict[str, str],
    existing_nodes: list[dict],
) -> list[dict]:
    """Build dependency edges between files based on import analysis."""
    edges: list[dict] = []
    node_ids = {n["id"] for n in existing_nodes}

    for file_path, content in file_contents.items():
        imports = parse_imports(content, file_path)
        for imp in imports:
            candidates = [
                imp,
                f"{imp}.ts", f"{imp}.tsx", f"{imp}.js", f"{imp}.jsx",
                f"{imp}/index.ts", f"{imp}/index.tsx", f"{imp}/index.js",
                f"{imp}.py",
            ]
            target = next((c for c in candidates if c in node_ids), None)
            if target and target != file_path:
                fn_calls = trace_function_calls(content, file_path, [target])
                label = (
                    f"calls {', '.join(fn_calls[0]['functions'][:2])}"
                    if fn_calls
                    else "imports"
                )
                edges.append(_make_edge(
                    edge_id=f"dep:{file_path}->{target}",
                    source=file_path,
                    target=target,
                    animated=True,
                    style={"stroke": "oklch(0.82 0.16 195)", "strokeWidth": 1.5},
                    data={"type": "call" if fn_calls else "import", "label": label},
                    label=label,
                ))

    return edges


# ─── Level 3: API Route Discovery ───────────────────────────────────

def is_api_file(path: str) -> bool:
    """Check if a file is an API route or controller."""
    role = classify_node_role(path)
    return role in ("api", "controller")


def detect_api_methods(content: str) -> list[str]:
    """Detect HTTP methods defined in a file."""
    methods: list[str] = []

    for m in re.finditer(r"(?:router|app)\.(get|post|put|patch|delete)\s*\(", content, re.IGNORECASE):
        methods.append(m.group(1).upper())

    for m in re.finditer(r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b", content):
        methods.append(m.group(1))

    for m in re.finditer(r"@(?:app|router)\.(get|post|put|patch|delete)\s*\(", content, re.IGNORECASE):
        methods.append(m.group(1).upper())

    return list(dict.fromkeys(methods))


# ─── Smart Filtering ─────────────────────────────────────────────────

def filter_architecture_nodes(
    nodes: list[dict],
    edges: list[dict],
) -> dict:
    """Filter nodes to show only architecturally significant ones."""
    important_roles = {"entry", "controller", "api", "service", "model"}

    connected_ids: set[str] = set()
    for edge in edges:
        if edge.get("data", {}).get("type") in ("import", "call"):
            connected_ids.add(edge["source"])
            connected_ids.add(edge["target"])

    keep_ids: set[str] = set()
    for node in nodes:
        if node["data"]["type"] == "folder":
            continue
        if node["data"]["role"] in important_roles:
            keep_ids.add(node["id"])
        elif node["id"] in connected_ids:
            keep_ids.add(node["id"])

    # Add parent folders for kept files
    for node_id in list(keep_ids):
        parts = node_id.split("/")
        for i in range(1, len(parts)):
            keep_ids.add("/".join(parts[:i]))

    filtered_nodes = [n for n in nodes if n["id"] in keep_ids]
    filtered_node_ids = {n["id"] for n in filtered_nodes}
    filtered_edges = [
        e for e in edges
        if e["source"] in filtered_node_ids and e["target"] in filtered_node_ids
    ]

    return {"nodes": filtered_nodes, "edges": filtered_edges}


# ─── Helpers ────────────────────────────────────────────────────────

def _resolve_path(from_dir: str, import_path: str) -> str:
    """Resolve a relative import path from a directory."""
    from_parts = [p for p in from_dir.split("/") if p]
    import_parts = [p for p in import_path.split("/") if p]

    result = list(from_parts)
    for part in import_parts:
        if part == ".":
            continue
        elif part == "..":
            if result:
                result.pop()
        else:
            result.append(part)
    return "/".join(result)


# ─── Graph Layout (replaces Dagre) ──────────────────────────────────

def layout_graph(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """
    Apply a hierarchical left-to-right layout to nodes using networkx.
    This replaces the Dagre layout from the TypeScript version.
    """
    if not nodes:
        return nodes

    G = nx.DiGraph()

    node_sizes: dict[str, tuple[int, int]] = {}
    for node in nodes:
        label = node["data"]["label"]
        width = max(160, len(label) * 9 + 80)
        height = 70 if node["data"]["type"] == "api" else 55
        G.add_node(node["id"])
        node_sizes[node["id"]] = (width, height)

    for edge in edges:
        if G.has_node(edge["source"]) and G.has_node(edge["target"]):
            G.add_edge(edge["source"], edge["target"])

    # Use a hierarchical layout
    # We'll assign layers based on longest path from roots, then spread nodes vertically
    if len(G.nodes) == 0:
        return nodes

    # Find roots (nodes with no incoming edges)
    roots = [n for n in G.nodes if G.in_degree(n) == 0]
    if not roots:
        # If there are cycles, pick the first node
        roots = [list(G.nodes)[0]]

    # BFS to assign layers (x-axis depth)
    layers: dict[str, int] = {}
    visited: set[str] = set()
    queue: list[tuple[str, int]] = [(r, 0) for r in roots]

    while queue:
        node_id, depth = queue.pop(0)
        if node_id in visited:
            # Update to max depth if already visited
            if depth > layers.get(node_id, 0):
                layers[node_id] = depth
            continue
        visited.add(node_id)
        layers[node_id] = max(layers.get(node_id, 0), depth)
        for successor in G.successors(node_id):
            queue.append((successor, depth + 1))

    # Assign positions to unvisited nodes (disconnected components)
    max_layer = max(layers.values()) if layers else 0
    for node_id in G.nodes:
        if node_id not in layers:
            max_layer += 1
            layers[node_id] = max_layer

    # Group nodes by layer
    layer_groups: dict[int, list[str]] = {}
    for node_id, layer in layers.items():
        layer_groups.setdefault(layer, []).append(node_id)

    # Layout parameters (matching Dagre config)
    ranksep = 200  # horizontal spacing between ranks
    nodesep = 60   # vertical spacing between nodes in same rank
    margin_x = 40
    margin_y = 40

    # Assign positions
    positions: dict[str, dict[str, float]] = {}
    for layer, node_ids in layer_groups.items():
        x = margin_x + layer * ranksep
        total_height = sum(node_sizes.get(nid, (160, 55))[1] for nid in node_ids)
        total_height += (len(node_ids) - 1) * nodesep
        start_y = margin_y + (0 - total_height / 2)  # Center vertically

        current_y = start_y
        for nid in node_ids:
            w, h = node_sizes.get(nid, (160, 55))
            positions[nid] = {"x": x - w / 2, "y": current_y - h / 2}
            current_y += h + nodesep

    # Apply positions to nodes
    result = []
    for node in nodes:
        pos = positions.get(node["id"])
        if pos:
            node_copy = {**node, "position": pos}
        else:
            node_copy = node
        result.append(node_copy)

    return result
