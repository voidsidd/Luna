import { NextResponse } from "next/server";
import { parseBrainDump } from "@/lib/parser/manualParser";
import { parseBrainDumpWithGroq } from "@/lib/groq/parseBrainDump";

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: string; mode?: "manual" | "ai" };
  const input = body.input?.trim() ?? "";

  if (!input) return NextResponse.json({ tasks: [] });

  if (body.mode !== "ai") {
    return NextResponse.json({ tasks: parseBrainDump(input), source: "manual" });
  }

  try {
    const tasks = await parseBrainDumpWithGroq(input);
    return NextResponse.json({ tasks, source: "groq" });
  } catch (error) {
    console.warn("Groq parse failed; falling back to manual parser.", error);
    return NextResponse.json({ tasks: parseBrainDump(input), source: "manual", warning: "AI parsing unavailable; used manual parser." });
  }
}
