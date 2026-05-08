"use client";

import { Check, Inbox, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { parseBrainDump } from "@/lib/parser/manualParser";
import { createTask } from "@/lib/tasks/createTask";
import type { ParsedTaskDraft, Task, TaskCategory } from "@/lib/types";

type EditableDraft = ParsedTaskDraft & {
  localId: string;
};

export function BrainDump({ onAccept }: { onAccept: (task: Task) => void | Promise<void> }) {
  const [input, setInput] = useState("");
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function organize() {
    if (!input.trim()) return;
    setIsParsing(true);
    setMessage(null);
    const now = new Date();
    try {
      const response = await fetch("/api/parse-brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          currentTime: {
            iso: now.toISOString(),
            local: now.toString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: navigator.language
          }
        })
      });
      const payload = (await response.json()) as { tasks?: ParsedTaskDraft[]; clarifyingQuestions?: string[]; source?: string; warning?: string };
      const parsed = (payload.tasks?.length ? payload.tasks : parseBrainDump(input)).map(withLocalId);
      setDrafts(parsed);
      setClarifyingQuestions(payload.clarifyingQuestions ?? []);
      setMessage(payload.warning ?? null);
    } catch {
      setDrafts(parseBrainDump(input).map(withLocalId));
      setClarifyingQuestions([]);
      setMessage("AI parsing was unavailable, so I used the conservative parser.");
    } finally {
      setIsParsing(false);
    }
  }

  async function acceptDraft(draft: EditableDraft) {
    await onAccept(createTask(stripLocalId(draft)));
    setDrafts((current) => current.filter((item) => item.localId !== draft.localId));
  }

  function rejectDraft(localId: string) {
    setDrafts((current) => current.filter((item) => item.localId !== localId));
  }

  async function acceptAll() {
    for (const draft of drafts) {
      await onAccept(createTask(stripLocalId(draft)));
    }
    setInput("");
    setDrafts([]);
    setClarifyingQuestions([]);
    setMessage(null);
  }

  function updateDraft(localId: string, patch: Partial<EditableDraft>) {
    setDrafts((current) => current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft)));
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <Inbox size={18} />
        <h2 className="font-semibold">Brain Dump</h2>
      </header>
      <div className="space-y-3 p-4">
        <textarea
          className="field min-h-32 resize-y"
          placeholder="One messy dump is fine. For best results, put separate tasks on separate lines."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />

        <button className="btn btn-primary w-full disabled:opacity-45" disabled={!input.trim() || isParsing} onClick={organize}>
          <Wand2 size={16} />
          {isParsing ? "Organizing..." : "Organize"}
        </button>

        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

        {clarifyingQuestions.length > 0 ? (
          <div className="rounded-[18px] border border-blue-100 bg-blue-50/80 p-3 text-sm text-slate-700">
            <p className="font-semibold text-[var(--foreground)]">Quick clarifications</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {clarifyingQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {drafts.length > 0 ? (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <DraftReview key={draft.localId} draft={draft} onChange={(patch) => updateDraft(draft.localId, patch)} onAccept={() => acceptDraft(draft)} onReject={() => rejectDraft(draft.localId)} />
            ))}
            <button className="btn btn-dark w-full" onClick={acceptAll}>
              Accept all remaining
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DraftReview({
  draft,
  onChange,
  onAccept,
  onReject
}: {
  draft: EditableDraft;
  onChange: (patch: Partial<EditableDraft>) => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const deadlineValue = draft.deadline ? draft.deadline.slice(0, 16) : "";

  return (
    <div className="subtle-card space-y-3 p-3 text-sm">
      <input className="field" value={draft.title} onChange={(event) => onChange({ title: event.target.value })} />
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <input className="field" type="datetime-local" value={deadlineValue} onChange={(event) => onChange({ deadline: event.target.value ? new Date(event.target.value).toISOString() : undefined })} />
        <select className="field" value={draft.category} onChange={(event) => onChange({ category: event.target.value as TaskCategory })}>
          <option value="competition">Competition</option>
          <option value="school">School</option>
          <option value="chore">Chore</option>
          <option value="personal">Personal</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {!draft.deadline ? <p className="text-xs text-[var(--warning)]">No deadline found. Add one if this can become urgent.</p> : null}
      {draft.category === "competition" ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <input className="field" placeholder="Opportunity name" value={draft.opportunityName ?? ""} onChange={(event) => onChange({ opportunityName: event.target.value || undefined })} />
            <select className="field" value={draft.eventImportance ?? draft.impact} onChange={(event) => onChange({ eventImportance: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}>
              <option value={1}>Importance 1</option>
              <option value={2}>Importance 2</option>
              <option value={3}>Importance 3</option>
              <option value={4}>Importance 4</option>
              <option value={5}>Importance 5</option>
            </select>
          </div>
          <input className="field" placeholder="Submission URL" value={draft.submissionUrl ?? ""} onChange={(event) => onChange({ submissionUrl: event.target.value || undefined })} />
          <input className="field" placeholder="Requirements" value={draft.requirements ?? ""} onChange={(event) => onChange({ requirements: event.target.value || undefined })} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button className="btn btn-success flex-1" onClick={onAccept}>
          <Check size={16} />
          Accept
        </button>
        <button className="btn btn-soft px-3" onClick={onReject} title="Reject">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function withLocalId(draft: ParsedTaskDraft): EditableDraft {
  return {
    ...draft,
    localId: crypto.randomUUID()
  };
}

function stripLocalId(draft: EditableDraft): ParsedTaskDraft {
  const { localId: _localId, ...taskDraft } = draft;
  return taskDraft;
}
