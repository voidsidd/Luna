"use client";

import { Inbox, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { parseBrainDump } from "@/lib/parser/manualParser";
import { createTask } from "@/lib/tasks/createTask";
import type { ParsedTaskDraft, Task } from "@/lib/types";

export function BrainDump({ onAccept }: { onAccept: (task: Task) => void }) {
  const [input, setInput] = useState("");
  const [aiDrafts, setAiDrafts] = useState<ParsedTaskDraft[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const manualDrafts = useMemo(() => parseBrainDump(input), [input]);
  const drafts = aiDrafts ?? manualDrafts;

  function acceptAll() {
    drafts.forEach((draft) => onAccept(createTask(draft)));
    setInput("");
    setAiDrafts(null);
    setMessage(null);
  }

  async function enhanceWithAi() {
    if (!input.trim()) return;
    setIsParsing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/parse-brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: "ai" })
      });
      const payload = (await response.json()) as { tasks?: ParsedTaskDraft[]; source?: string; warning?: string };
      setAiDrafts(payload.tasks ?? []);
      setMessage(payload.warning ?? `Parsed with ${payload.source ?? "manual"} parser.`);
    } catch {
      setAiDrafts(manualDrafts);
      setMessage("AI parsing was unavailable, so the manual parser stayed in control.");
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <section className="rounded-md border border-[var(--line)] bg-white">
      <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <Inbox size={18} />
        <h2 className="font-semibold">Brain Dump</h2>
      </header>
      <div className="space-y-3 p-4">
        <textarea
          className="min-h-32 w-full resize-y rounded border border-[var(--line)] px-3 py-2"
          placeholder="Paste the messy version: physics due tomorrow, laundry, register for hackathon by Sunday..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        {drafts.length > 0 ? (
          <div className="space-y-2">
            {drafts.map((draft, index) => (
              <div key={`${draft.title}-${index}`} className="rounded border border-[var(--line)] bg-field p-3 text-sm">
                <p className="font-semibold">{draft.title}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {draft.category} - {draft.deadline ? new Date(draft.deadline).toLocaleDateString() : "no deadline"} - {draft.energyRequired} energy
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        <button
          className="flex w-full items-center justify-center gap-2 rounded border border-[var(--line)] bg-white px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          disabled={drafts.length === 0 || isParsing}
          onClick={enhanceWithAi}
        >
          <Wand2 size={16} />
          {isParsing ? "Parsing..." : "Clean up with AI"}
        </button>
        <button
          className="flex w-full items-center justify-center gap-2 rounded bg-steel px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={drafts.length === 0}
          onClick={acceptAll}
        >
          <Wand2 size={16} />
          Accept parsed tasks
        </button>
      </div>
    </section>
  );
}
