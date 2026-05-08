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
    <section className="panel">
      <header className="panel-header">
        <Plus size={18} />
        <h2 className="font-semibold">Add Task</h2>
      </header>
      <form className="space-y-3 p-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Deadline</span>
          <input
            className="field mt-1"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Category</span>
            <select className="field mt-1" value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)}>
              <option value="personal">Personal</option>
              <option value="competition">Competition</option>
              <option value="school">School</option>
              <option value="chore">Chore</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Impact</span>
            <select className="field mt-1" value={impact} onChange={(event) => setImpact(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>
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
          <select className="field mt-1" value={energyRequired} onChange={(event) => setEnergyRequired(event.target.value as EnergyLevel)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <button className="btn btn-primary w-full" type="submit">
          <Plus size={16} />
          Add
        </button>
      </form>
    </section>
  );
}
