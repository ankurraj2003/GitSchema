// Schema parser — Detects and parses schema files into Mermaid ERD syntax.

export interface SchemaEntity {
    name: string;
    fields: { name: string; type: string; isPrimary?: boolean; isRelation?: boolean }[];
}

export function detectSchemaFiles(paths: string[]): string[] {
    const schemaPatterns = [
        /schema\.prisma$/,
        /\.sql$/,
        /models\.py$/,
        /schema\.(ts|js)$/,
        /migrations?\//,
    ];
    return paths.filter((p) => schemaPatterns.some((pat) => pat.test(p)));
}

export function parsePrismaSchema(content: string): SchemaEntity[] {
    const entities: SchemaEntity[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(content)) !== null) {
        const name = match[1];
        const body = match[2];
        const fields: SchemaEntity["fields"] = [];

        const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (line.startsWith("//") || line.startsWith("@@")) continue;
            const fieldMatch = line.match(/^(\w+)\s+(\S+)/);
            if (fieldMatch) {
                const [, fieldName, fieldType] = fieldMatch;
                fields.push({
                    name: fieldName,
                    type: fieldType.replace("?", "").replace("[]", ""),
                    isPrimary: line.includes("@id"),
                    isRelation: line.includes("@relation"),
                });
            }
        }

        entities.push({ name, fields });
    }

    return entities;
}

export function parseSqlSchema(content: string): SchemaEntity[] {
    const entities: SchemaEntity[] = [];
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([^)]+)\)/gi;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
        const name = match[1];
        const body = match[2];
        const fields: SchemaEntity["fields"] = [];

        const lines = body.split(",").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (/^(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT)/i.test(line)) continue;
            const fieldMatch = line.match(/^[`"']?(\w+)[`"']?\s+(\w+)/);
            if (fieldMatch) {
                fields.push({
                    name: fieldMatch[1],
                    type: fieldMatch[2],
                    isPrimary: /PRIMARY\s+KEY/i.test(line),
                    isRelation: /REFERENCES/i.test(line),
                });
            }
        }

        entities.push({ name, fields });
    }

    return entities;
}

export function entitiesToMermaidERD(entities: SchemaEntity[]): string {
    if (entities.length === 0) return "";

    let diagram = "erDiagram\n";

    for (const entity of entities) {
        diagram += `    ${entity.name} {\n`;
        for (const field of entity.fields) {
            const pk = field.isPrimary ? "PK" : "";
            const fk = field.isRelation ? "FK" : "";
            const marker = pk || fk;
            diagram += `        ${field.type} ${field.name}${marker ? ` ${marker}` : ""}\n`;
        }
        diagram += `    }\n`;
    }

    // Add relations
    for (const entity of entities) {
        for (const field of entity.fields) {
            if (field.isRelation) {
                const relTarget = entities.find((e) => e.name === field.type);
                if (relTarget) {
                    diagram += `    ${entity.name} ||--o{ ${relTarget.name} : "${field.name}"\n`;
                }
            }
        }
    }

    return diagram;
}
