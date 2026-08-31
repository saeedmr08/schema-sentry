import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { OpenApiLike } from "./diff";

export type SpecPair = {
  before: OpenApiLike;
  after: OpenApiLike;
};

const DATA_FILE = path.join(process.cwd(), "data", "specs.json");

const BEFORE_SAMPLE: OpenApiLike = {
  openapi: "3.0.3",
  info: { title: "Demo API", version: "1.0.0" },
  paths: {
    "/users": {
      get: { operationId: "listUsers" },
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "name"],
                properties: {
                  email: { type: "string" },
                  name: { type: "string" },
                  age: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    "/orders/{id}": {
      get: { operationId: "getOrder" },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" }, role: { type: "string" } },
      },
    },
  },
};

const AFTER_SAMPLE: OpenApiLike = {
  openapi: "3.0.3",
  info: { title: "Demo API", version: "2.0.0" },
  paths: {
    "/users": {
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string" },
                  age: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "integer" }, role: { type: "string" } },
      },
    },
  },
};

function seed(): SpecPair {
  return { before: BEFORE_SAMPLE, after: AFTER_SAMPLE };
}

export function readSpecs(): SpecPair {
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as SpecPair;
    if (!raw.before || !raw.after) throw new Error("invalid shape");
    return raw;
  } catch {
    const data = seed();
    writeSpecs(data);
    return data;
  }
}

export function writeSpecs(data: SpecPair): void {
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}
