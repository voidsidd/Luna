import { NextResponse } from "next/server";
import { parseBrainDump } from "@/lib/parser/manualParser";
import { parseBrainDumpWithGroq } from "@/lib/groq/parseBrainDump";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    input?: string;
    currentTime?: {
      iso?: string;
      local?: string;
      timezone?: string;
      locale?: string;
    };
  };
  const input = body.input?.trim() ?? "";

  if (!input) return NextResponse.json({ tasks: [] });

  try {
    const result = await parseBrainDumpWithGroq(input, body.currentTime);
    return NextResponse.json({ ...result, source: "groq" });
  } catch (error) {
    console.warn("Groq parse failed; falling back to manual parser.", error);
    return NextResponse.json({ tasks: parseBrainDump(input), clarifyingQuestions: [], source: "manual-fallback", warning: "AI unavailable; used a conservative fallback." });
  }
}
