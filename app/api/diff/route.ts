import { NextResponse } from "next/server";

import { diffOpenApi, summarize, type OpenApiLike } from "@/lib/diff";
import { readSpecs, writeSpecs } from "@/lib/store";

export async function GET() {
  return NextResponse.json(readSpecs());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    before?: OpenApiLike;
    after?: OpenApiLike;
  };

  if (!body.before || !body.after) {
    return NextResponse.json(
      { error: "before and after specs required" },
      { status: 400 },
    );
  }

  const data = { before: body.before, after: body.after };
  writeSpecs(data);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    before?: OpenApiLike;
    after?: OpenApiLike;
  };

  if (!body.before || !body.after) {
    return NextResponse.json(
      { error: "before and after specs required" },
      { status: 400 },
    );
  }

  const changes = diffOpenApi(body.before, body.after);
  return NextResponse.json({
    changes,
    summary: summarize(changes),
  });
}
