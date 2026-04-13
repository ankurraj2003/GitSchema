"""
Schema parser — Detects and parses schema files into Mermaid ERD syntax.
Port of src/lib/schema-parser.ts
"""

import re


# ─── Types ──────────────────────────────────────────────────────────

def _make_field(name: str, field_type: str, is_primary: bool = False, is_relation: bool = False) -> dict:
    return {
        "name": name,
        "type": field_type,
        "isPrimary": is_primary,
        "isRelation": is_relation,
    }


def _make_entity(name: str, fields: list[dict]) -> dict:
    return {"name": name, "fields": fields}


# ─── Schema File Detection ──────────────────────────────────────────

def detect_schema_files(paths: list[str]) -> list[str]:
    """Identify schema files from a list of file paths."""
    schema_patterns = [
        re.compile(r"schema\.prisma$"),
        re.compile(r"\.sql$"),
        re.compile(r"models\.py$"),
        re.compile(r"schema\.(ts|js)$"),
        re.compile(r"migrations?/"),
    ]
    return [p for p in paths if any(pat.search(p) for pat in schema_patterns)]


# ─── Prisma Schema Parsing ─────────────────────────────────────────

def parse_prisma_schema(content: str) -> list[dict]:
    """Parse a Prisma schema file into entity definitions."""
    entities: list[dict] = []
    model_regex = re.compile(r"model\s+(\w+)\s*\{([^}]+)\}", re.DOTALL)

    for match in model_regex.finditer(content):
        name = match.group(1)
        body = match.group(2)
        fields: list[dict] = []

        for line in body.split("\n"):
            line = line.strip()
            if not line or line.startswith("//") or line.startswith("@@"):
                continue
            field_match = re.match(r"^(\w+)\s+(\S+)", line)
            if field_match:
                field_name = field_match.group(1)
                field_type = field_match.group(2).replace("?", "").replace("[]", "")
                fields.append(_make_field(
                    name=field_name,
                    field_type=field_type,
                    is_primary="@id" in line,
                    is_relation="@relation" in line,
                ))

        entities.append(_make_entity(name, fields))

    return entities


# ─── SQL Schema Parsing ────────────────────────────────────────────

def parse_sql_schema(content: str) -> list[dict]:
    """Parse a SQL schema file into entity definitions."""
    entities: list[dict] = []
    table_regex = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"']?(\w+)[`\"']?\s*\(([^)]+)\)",
        re.IGNORECASE,
    )

    for match in table_regex.finditer(content):
        name = match.group(1)
        body = match.group(2)
        fields: list[dict] = []

        for line in body.split(","):
            line = line.strip()
            if not line:
                continue
            if re.match(r"^(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT)", line, re.IGNORECASE):
                continue
            field_match = re.match(r"^[`\"']?(\w+)[`\"']?\s+(\w+)", line)
            if field_match:
                fields.append(_make_field(
                    name=field_match.group(1),
                    field_type=field_match.group(2),
                    is_primary=bool(re.search(r"PRIMARY\s+KEY", line, re.IGNORECASE)),
                    is_relation=bool(re.search(r"REFERENCES", line, re.IGNORECASE)),
                ))

        entities.append(_make_entity(name, fields))

    return entities


# ─── Mermaid ERD Generation ─────────────────────────────────────────

def entities_to_mermaid_erd(entities: list[dict]) -> str:
    """Convert entity definitions to Mermaid ERD syntax."""
    if not entities:
        return ""

    diagram = "erDiagram\n"

    for entity in entities:
        diagram += f"    {entity['name']} {{\n"
        for field in entity["fields"]:
            pk = "PK" if field.get("isPrimary") else ""
            fk = "FK" if field.get("isRelation") else ""
            marker = pk or fk
            suffix = f" {marker}" if marker else ""
            diagram += f"        {field['type']} {field['name']}{suffix}\n"
        diagram += "    }\n"

    # Add relations
    for entity in entities:
        for field in entity["fields"]:
            if field.get("isRelation"):
                rel_target = next(
                    (e for e in entities if e["name"] == field["type"]),
                    None,
                )
                if rel_target:
                    diagram += f"    {entity['name']} ||--o{{ {rel_target['name']} : \"{field['name']}\"\n"

    return diagram
