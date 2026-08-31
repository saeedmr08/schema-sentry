import { describe, expect, it } from "vitest";
import { diffOpenApi, summarize, type OpenApiLike } from "./diff";

const base: OpenApiLike = {
  openapi: "3.0.0",
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
    "/orders": {
      get: { operationId: "listOrders" },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          role: { type: "string" },
        },
      },
    },
  },
};

describe("diffOpenApi", () => {
  it("detects removed paths", () => {
    const after: OpenApiLike = {
      ...base,
      paths: { "/users": base.paths!["/users"] },
    };
    const changes = diffOpenApi(base, after);
    expect(changes.some((c) => c.kind === "removed_path" && c.path === "/orders")).toBe(true);
  });

  it("detects removed required fields and type changes", () => {
    const after: OpenApiLike = structuredClone(base);
    const schema =
      after.paths!["/users"]!.post!.requestBody!.content!["application/json"]!.schema!;
    schema.required = ["email"];
    schema.properties!.age = { type: "string" };
    delete schema.properties!.name;

    const changes = diffOpenApi(base, after);
    expect(changes.some((c) => c.kind === "removed_required_field")).toBe(true);
    expect(changes.some((c) => c.kind === "type_change" && c.detail.includes("integer"))).toBe(
      true,
    );
  });

  it("detects removed methods and component type changes", () => {
    const after: OpenApiLike = structuredClone(base);
    delete after.paths!["/users"]!.get;
    after.components!.schemas!.User!.properties!.id = { type: "integer" };
    const changes = diffOpenApi(base, after);
    expect(changes.some((c) => c.kind === "removed_method")).toBe(true);
    expect(changes.some((c) => c.kind === "type_change")).toBe(true);
    const counts = summarize(changes);
    expect(counts.removed_method).toBeGreaterThanOrEqual(1);
  });
});
