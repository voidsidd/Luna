"use client";

import { BellRing, Clock, Send, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { loadNotificationChannels } from "@/lib/storage/notificationStore";
import { dismissReminder, loadReminders, markReminderSent, saveReminder } from "@/lib/storage/reminderStore";
import type { Reminder, ReminderType, Task } from "@/lib/types";

export function ReminderPanel({ tasks }: { tasks: Task[] }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [taskId, setTaskId] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [reminderType, setReminderType] = useState<ReminderType>("custom");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadReminders().then(setReminders);
  }, []);

  const activeTasks = tasks.filter((task) => task.status !== "done");
  const dueReminders = useMemo(() => reminders.filter((reminder) => reminder.status === "scheduled" && new Date(reminder.remindAt) <= new Date()), [reminders]);
  const upcoming = reminders.filter((reminder) => reminder.status === "scheduled" && new Date(reminder.remindAt) > new Date()).slice(0, 6);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!taskId || !remindAt) return;

    const saved = await saveReminder({
      id: crypto.randomUUID(),
      taskId,
      remindAt: new Date(remindAt).toISOString(),
      reminderType,
      status: "scheduled",
      createdAt: new Date().toISOString()
    });

    setReminders((current) => [saved, ...current].sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()));
    setRemindAt("");
  }

  async function dismiss(reminder: Reminder) {
    const saved = await dismissReminder(reminder);
    setReminders((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  }

  async function dispatchDue() {
    setMessage("Sending due reminders...");
    const channels = await loadNotificationChannels();
    const response = await fetch("/api/reminders/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminders: dueReminders, tasks, channels })
    });
    const payload = (await response.json()) as { ok: boolean; results?: Array<{ status: string }>; sentReminderIds?: string[]; message?: string };

    if (!payload.ok) {
      setMessage(payload.message ?? "Reminder dispatch failed.");
      return;
    }

    const sentIds = new Set(payload.sentReminderIds ?? []);
    const sentReminders = dueReminders.filter((reminder) => sentIds.has(reminder.id));
    const updated = await Promise.all(sentReminders.map(markReminderSent));
    setReminders((current) => current.map((item) => updated.find((reminder) => reminder.id === item.id) ?? item));

    const sent = payload.results?.filter((result) => result.status === "sent").length ?? 0;
    const skipped = payload.results?.filter((result) => result.status === "skipped").length ?? 0;
    const failed = payload.results?.filter((result) => result.status === "failed").length ?? 0;
    setMessage(`Dispatch finished. Sent ${sent}, skipped ${skipped}, failed ${failed}.`);
  }

  return (
    <section className="space-y-5">
      {dueReminders.length > 0 ? (
        <div className="rounded-[18px] border border-orange-200 bg-orange-50/80 p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-[var(--warning)]">
            <BellRing size={18} />
            Due reminders
          </h2>
          <div className="space-y-2">
            {dueReminders.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} task={tasks.find((task) => task.id === reminder.taskId)} onDismiss={dismiss} />
            ))}
          </div>
          <button className="btn btn-warning mt-3" onClick={dispatchDue}>
            <Send size={16} />
            Send due now
          </button>
        </div>
      ) : null}

      <div className="panel">
        <header className="panel-header">
          <Clock size={18} />
          <h2 className="font-semibold">Reminders</h2>
        </header>
        <div className="space-y-4 p-4">
          {message ? <p className="subtle-card p-3 text-sm text-[var(--muted)]">{message}</p> : null}
          <form className="grid gap-3 md:grid-cols-[1fr_210px_150px_auto]" onSubmit={submit}>
            <select className="field" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              <option value="">Choose task</option>
              {activeTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <input className="field" type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} />
            <select className="field" value={reminderType} onChange={(event) => setReminderType(event.target.value as ReminderType)}>
              <option value="custom">Custom</option>
              <option value="start">Start</option>
              <option value="deadline">Deadline</option>
              <option value="followup">Follow-up</option>
            </select>
            <button className="btn btn-dark">Add</button>
          </form>

          <div className="space-y-2">
            {upcoming.length === 0 ? <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">No upcoming reminders.</div> : null}
            {upcoming.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} task={tasks.find((task) => task.id === reminder.taskId)} onDismiss={dismiss} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReminderRow({ reminder, task, onDismiss }: { reminder: Reminder; task?: Task; onDismiss: (reminder: Reminder) => void }) {
  return (
    <div className="subtle-card flex items-center justify-between gap-3 p-3">
      <div>
        <p className="font-semibold">{task?.title ?? "Deleted task"}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {new Date(reminder.remindAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} - {reminder.reminderType}
        </p>
      </div>
      <button className="btn btn-soft px-3" title="Dismiss" onClick={() => onDismiss(reminder)}>
        <X size={16} />
      </button>
    </div>
  );
}
