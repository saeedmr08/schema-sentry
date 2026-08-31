/**
 * SchemaSentry — compare two OpenAPI-like JSON snapshots for breaking changes.
 */

export type JsonSchemaLike = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
  [key: string]: unknown;
};

export type OperationLike = {
  operationId?: string;
  parameters?: Array<{ name: string; in?: string; required?: boolean; schema?: JsonSchemaLike }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: JsonSchemaLike }>;
  };
  responses?: Record<string, unknown>;
};

export type PathItem = Partial<
  Record<"get" | "post" | "put" | "patch" | "delete" | "head" | "options", OperationLike>
>;

export type OpenApiLike = {
  openapi?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, JsonSchemaLike> };
};

export type BreakingKind =
  | "removed_path"
  | "removed_method"
  | "removed_required_field"
  | "type_change"
  | "required_added";

export type BreakingChange = {
  kind: BreakingKind;
  path: string;
  detail: string;
};

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

function schemaType(s?: JsonSchemaLike): string | undefined {
  if (!s) return undefined;
  return typeof s.type === "string" ? s.type : undefined;
}

function walkRequiredAndTypes(
  before: JsonSchemaLike | undefined,
  after: JsonSchemaLike | undefined,
  basePath: string,
  out: BreakingChange[],
): void {
  if (!before) return;

  const beforeRequired = new Set(before.required ?? []);
  const afterRequired = new Set(after?.required ?? []);
  const afterProps = after?.properties ?? {};

  for (const field of beforeRequired) {
    if (!after || !(field in (after.properties ?? {}))) {
      out.push({
        kind: "removed_required_field",
        path: `${basePath}.${field}`,
        detail: `Required field "${field}" was removed`,
      });
    }
  }

  // New required fields on existing schemas are also breaking for clients
  if (after) {
    for (const field of afterRequired) {
      if (!beforeRequired.has(field) && before.properties && field in before.properties) {
        out.push({
          kind: "required_added",
          path: `${basePath}.${field}`,
          detail: `Field "${field}" became required`,
        });
      } else if (!beforeRequired.has(field) && !(before.properties && field in before.properties)) {
        out.push({
          kind: "required_added",
          path: `${basePath}.${field}`,
          detail: `New required field "${field}" added`,
        });
      }
    }
  }

  const beforeProps = before.properties ?? {};
  for (const [name, prop] of Object.entries(beforeProps)) {
    const next = afterProps[name];
    const bt = schemaType(prop);
    const at = schemaType(next);
    if (next && bt && at && bt !== at) {
      out.push({
        kind: "type_change",
        path: `${basePath}.${name}`,
        detail: `Type changed from ${bt} to ${at}`,
      });
    }
    if (prop?.properties || next?.properties) {
      walkRequiredAndTypes(prop, next, `${basePath}.${name}`, out);
    }
  }
}

function requestSchema(op?: OperationLike): JsonSchemaLike | undefined {
  const content = op?.requestBody?.content;
  if (!content) return undefined;
  const first = Object.values(content)[0];
  return first?.schema;
}

export function diffOpenApi(before: OpenApiLike, after: OpenApiLike): BreakingChange[] {
  const changes: BreakingChange[] = [];
  const beforePaths = before.paths ?? {};
  const afterPaths = after.paths ?? {};

  for (const path of Object.keys(beforePaths)) {
    if (!(path in afterPaths)) {
      changes.push({
        kind: "removed_path",
        path,
        detail: `Path ${path} was removed`,
      });
      continue;
    }
    const beforeItem = beforePaths[path]!;
    const afterItem = afterPaths[path]!;
    for (const method of METHODS) {
      const beforeOp = beforeItem[method];
      const afterOp = afterItem[method];
      if (beforeOp && !afterOp) {
        changes.push({
          kind: "removed_method",
          path: `${method.toUpperCase()} ${path}`,
          detail: `Method ${method.toUpperCase()} removed from ${path}`,
        });
        continue;
      }
      if (beforeOp && afterOp) {
        walkRequiredAndTypes(
          requestSchema(beforeOp),
          requestSchema(afterOp),
          `${method.toUpperCase()} ${path} body`,
          changes,
        );
      }
    }
  }

  const beforeSchemas = before.components?.schemas ?? {};
  const afterSchemas = after.components?.schemas ?? {};
  for (const [name, schema] of Object.entries(beforeSchemas)) {
    walkRequiredAndTypes(schema, afterSchemas[name], `#/components/schemas/${name}`, changes);
  }

  return changes;
}

export function summarize(changes: BreakingChange[]): Record<BreakingKind, number> {
  const counts: Record<BreakingKind, number> = {
    removed_path: 0,
    removed_method: 0,
    removed_required_field: 0,
    type_change: 0,
    required_added: 0,
  };
  for (const c of changes) counts[c.kind] += 1;
  return counts;
}
