"use client";

import { Check, Clock, Pencil, TimerReset } from "lucide-react";
import { useState } from "react";
import { scoreTask } from "@/lib/priority/scoreTask";
import type { Task } from "@/lib/types";

export function TaskList({
  tasks,
  onDone,
  onSnooze,
  onSave,
  onFeedback,
  compact = false
}: {
  tasks: Task[];
  onDone: (task: Task) => void;
  onSnooze: (task: Task) => void;
  onSave?: (task: Task) => void;
  onFeedback?: (task: Task, eventType: "too_tired" | "too_hard" | "not_now") => void;
  compact?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = [...tasks].sort((a, b) => scoreTask(b) - scoreTask(a));

  if (sorted.length === 0) {
    return <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">No tasks here.</div>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((task) =>
        editingId === task.id && onSave ? (
          <InlineEdit key={task.id} task={task} onCancel={() => setEditingId(null)} onSave={(next) => { onSave(next); setEditingId(null); }} />
        ) : (
          <article key={task.id} className={`subtle-card transition hover:-translate-y-0.5 hover:shadow-md ${compact ? "p-3" : "p-4"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{task.title}</h3>
                  <span className="chip">{task.category}</span>
                  <span className="chip">Score {scoreTask(task)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {task.deadline ? new Date(task.deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No deadline"}
                  </span>
                  <span>{task.effortMinutes ?? "?"} min</span>
                  <span>{task.energyRequired} energy</span>
                  <span>{task.status}</span>
                </div>
                {!compact && task.nextAction ? <p className="mt-2 text-sm text-[var(--muted)]">Start: {task.nextAction}</p> : null}
                {!compact && onFeedback ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn btn-soft min-h-0 px-3 py-1 text-xs" onClick={() => onFeedback(task, "too_tired")}>
                      Too tired
                    </button>
                    <button className="btn btn-soft min-h-0 px-3 py-1 text-xs" onClick={() => onFeedback(task, "too_hard")}>
                      Too hard
                    </button>
                    <button className="btn btn-soft min-h-0 px-3 py-1 text-xs" onClick={() => onFeedback(task, "not_now")}>
                      Not now
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                {onSave ? (
                  <button className="btn btn-soft px-3" title="Edit task" onClick={() => setEditingId(task.id)}>
                    <Pencil size={16} />
                  </button>
                ) : null}
                <button className="btn btn-soft px-3" title="Snooze task" onClick={() => onSnooze(task)}>
                  <TimerReset size={16} />
                </button>
                <button className="btn btn-success px-3" title="Mark done" onClick={() => onDone(task)}>
                  <Check size={16} />
                </button>
              </div>
            </div>
          </article>
        )
      )}
    </div>
  );
}

function InlineEdit({ task, onCancel, onSave }: { task: Task; onCancel: () => void; onSave: (task: Task) => void }) {
  const [title, setTitle] = useState(task.title);
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.slice(0, 16) : "");

  return (
    <div className="subtle-card p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="field" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn btn-soft" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-dark"
          onClick={() =>
            onSave({
              ...task,
              title,
              deadline: deadline ? new Date(deadline).toISOString() : undefined,
              updatedAt: new Date().toISOString()
            })
          }
        >
          Save
        </button>
      </div>
    </div>
  );
}
