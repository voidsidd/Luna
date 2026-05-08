"use client";

import { Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { createTask } from "@/lib/tasks/createTask";
import type { EnergyLevel, Task, TaskCategory } from "@/lib/types";

export function TaskEditor({ onSave }: { onSave: (task: Task) => void }) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState<TaskCategory>("personal");
  const [impact, setImpact] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energyRequired, setEnergyRequired] = useState<EnergyLevel>("medium");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave(
      createTask({
        title,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        category,
        impact,
        effortMinutes: 30,
        energyRequired
      })
    );
    setTitle("");
    setDeadline("");
    setCategory("personal");
    setImpact(3);
    setEnergyRequired("medium");
  }

  return (
    <section className="rounded-md border border-[var(--line)] bg-white">
      <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <Plus size={18} />
        <h2 className="font-semibold">Add Task</h2>
      </header>
      <form className="space-y-3 p-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input className="mt-1 w-full rounded border border-[var(--line)] px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Deadline</span>
          <input
            className="mt-1 w-full rounded border border-[var(--line)] px-3 py-2"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Category</span>
            <select className="mt-1 w-full rounded border border-[var(--line)] px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)}>
              <option value="personal">Personal</option>
              <option value="competition">Competition</option>
              <option value="school">School</option>
              <option value="chore">Chore</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Impact</span>
            <select className="mt-1 w-full rounded border border-[var(--line)] px-3 py-2" value={impact} onChange={(event) => setImpact(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Energy</span>
          <select className="mt-1 w-full rounded border border-[var(--line)] px-3 py-2" value={energyRequired} onChange={(event) => setEnergyRequired(event.target.value as EnergyLevel)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <button className="flex w-full items-center justify-center gap-2 rounded bg-ink px-4 py-2 font-semibold text-white" type="submit">
          <Plus size={16} />
          Add
        </button>
      </form>
    </section>
  );
}
