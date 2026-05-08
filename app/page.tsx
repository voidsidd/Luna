"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CalendarDays, Check, Clock, ListChecks, Sparkles, TimerReset } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { BrainDump } from "@/components/BrainDump";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ReminderPanel } from "@/components/ReminderPanel";
import { TaskEditor } from "@/components/TaskEditor";
import { TaskList } from "@/components/TaskList";
import { loadTasks, saveTask, updateTask } from "@/lib/storage/taskStore";
import { loadTaskEvents, recordTaskEvent } from "@/lib/storage/taskEventStore";
import { explainTask, scoreTask } from "@/lib/priority/scoreTask";
import { recommendNextTask } from "@/lib/priority/recommendNextTask";
import { summarizePatterns } from "@/lib/priority/userPatterns";
import type { Task, TaskEvent, TaskEventType, TaskStatus } from "@/lib/types";

const tabs = ["Now", "Tasks", "Deadlines", "Reminders", "Settings"] as const;
type Tab = (typeof tabs)[number];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [tab, setTab] = useState<Tab>("Now");
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshData = useCallback(() => {
    Promise.all([loadTasks(), loadTaskEvents()]).then(([taskItems, eventItems]) => {
      setTasks(taskItems);
      setEvents(eventItems);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const activeTasks = useMemo(() => tasks.filter((task) => task.status === "active" || task.status === "snoozed"), [tasks]);
  const patterns = useMemo(() => summarizePatterns(events, tasks), [events, tasks]);
  const rankedTasks = useMemo(
    () => activeTasks.map((task) => ({ task, score: scoreTask(task, patterns), reason: explainTask(task) })).sort((a, b) => b.score - a.score),
    [activeTasks, patterns]
  );
  const recommendation = useMemo(() => recommendNextTask(activeTasks, patterns), [activeTasks, patterns]);

  async function upsertTask(task: Task) {
    const saved = await saveTask(task);
    setTasks((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
    });
  }

  async function setStatus(task: Task, status: TaskStatus) {
    const saved = await updateTask({ ...task, status, updatedAt: new Date().toISOString() });
    setTasks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    await logEvent(saved, status === "done" ? "completed" : "edited");
  }

  async function snoozeTask(task: Task) {
    const saved = await updateTask({ ...task, status: "snoozed", snoozedUntil: nextMorning(), updatedAt: new Date().toISOString() });
    setTasks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    await logEvent(saved, "snoozed", { snoozedUntil: saved.snoozedUntil });
  }

  async function logEvent(task: Task, eventType: TaskEventType, metadata: Record<string, unknown> = {}) {
    const savedEvent = await recordTaskEvent(task, eventType, metadata);
    setEvents((current) => [savedEvent, ...current]);
  }

  async function markNeedsSmallerStep(task: Task, eventType: "too_tired" | "too_hard" | "not_now") {
    await logEvent(task, eventType);
    if (eventType === "too_hard") {
      const saved = await updateTask({
        ...task,
        effortMinutes: Math.min(task.effortMinutes ?? 45, 25),
        nextAction: task.nextAction ?? "Split this into the smallest useful first step.",
        updatedAt: new Date().toISOString()
      });
      setTasks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:flex-row md:items-end md:justify-between lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Priority Manager</p>
            <h1 className="mt-1 text-3xl font-semibold text-[var(--foreground)] md:text-4xl">Decide what matters next.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
              A task and deadline manager with a priority engine underneath. AI can help later, but the core works on its own.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-full border border-[var(--line)] bg-white/70 p-1 shadow-sm sm:flex">
            {tabs.map((item) => (
              <button
                key={item}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item ? "bg-[var(--foreground)] text-white shadow-sm" : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[360px_1fr] lg:px-6">
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <AuthPanel onSessionChange={refreshData} />
          <TaskEditor onSave={upsertTask} />
          <BrainDump onAccept={upsertTask} />
        </aside>

        <section className="min-h-[620px]">
          {!isLoaded ? (
            <Panel title="Loading" icon={<TimerReset size={18} />}>
              Loading your tasks.
            </Panel>
          ) : tab === "Now" ? (
            <NowView
              recommendation={recommendation}
              rankedTasks={rankedTasks}
              onDone={(task) => setStatus(task, "done")}
              onSnooze={snoozeTask}
              onFeedback={markNeedsSmallerStep}
            />
          ) : tab === "Tasks" ? (
            <TaskList tasks={tasks} onDone={(task) => setStatus(task, "done")} onSnooze={snoozeTask} onSave={upsertTask} onFeedback={markNeedsSmallerStep} />
          ) : tab === "Deadlines" ? (
            <DeadlineView tasks={tasks} patterns={patterns} onDone={(task) => setStatus(task, "done")} onSnooze={snoozeTask} onFeedback={markNeedsSmallerStep} />
          ) : tab === "Reminders" ? (
            <Panel title="Reminders" icon={<BellRing size={18} />}>
              <ReminderPanel tasks={tasks} />
            </Panel>
          ) : (
            <NotificationSettings />
          )}
        </section>
      </div>
    </main>
  );
}

function NowView({
  recommendation,
  rankedTasks,
  onDone,
  onSnooze,
  onFeedback
}: {
  recommendation: ReturnType<typeof recommendNextTask>;
  rankedTasks: Array<{ task: Task; score: number; reason: string }>;
  onDone: (task: Task) => void;
  onSnooze: (task: Task) => void;
  onFeedback: (task: Task, eventType: "too_tired" | "too_hard" | "not_now") => void;
}) {
  if (!recommendation) {
    return (
      <Panel title="Now" icon={<Sparkles size={18} />}>
        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <div className="mb-4 rounded-full bg-emerald-50 p-3 text-[var(--success)]">
            <Check size={36} />
          </div>
          <h2 className="text-2xl font-semibold">Nothing is demanding attention.</h2>
          <p className="mt-2 max-w-md text-[var(--muted)]">Add tasks manually or drop a messy brain dump into the inbox.</p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Panel title="Recommended Now" icon={<Sparkles size={18} />}>
        <div className="rounded-[18px] border border-[var(--line)] bg-white/72 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">Do this next</p>
              <h2 className="mt-2 text-2xl font-semibold">{recommendation.task.title}</h2>
              <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{recommendation.reason}</p>
              {recommendation.task.nextAction ? <p className="mt-3 font-medium">Start with: {recommendation.task.nextAction}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn btn-success" onClick={() => onDone(recommendation.task)}>
                Done
              </button>
              <button className="btn btn-soft" onClick={() => onSnooze(recommendation.task)}>
                Snooze
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
            <button className="btn btn-soft" onClick={() => onFeedback(recommendation.task, "too_tired")}>
              Too tired
            </button>
            <button className="btn btn-soft" onClick={() => onFeedback(recommendation.task, "too_hard")}>
              Too hard
            </button>
            <button className="btn btn-soft" onClick={() => onFeedback(recommendation.task, "not_now")}>
              Not now
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Backups" icon={<ListChecks size={18} />}>
        <div className="grid gap-3">
          {rankedTasks.slice(1, 5).map(({ task, score, reason }) => (
            <div key={task.id} className="subtle-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{reason}</p>
                </div>
                <span className="chip">Score {score}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DeadlineView({
  tasks,
  patterns,
  onDone,
  onSnooze,
  onFeedback
}: {
  tasks: Task[];
  patterns: Parameters<typeof scoreTask>[1];
  onDone: (task: Task) => void;
  onSnooze: (task: Task) => void;
  onFeedback: (task: Task, eventType: "too_tired" | "too_hard" | "not_now") => void;
}) {
  const active = tasks.filter((task) => task.status !== "done");
  const groups = groupByDeadline(active, patterns);

  return (
    <Panel title="Deadlines" icon={<CalendarDays size={18} />}>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {group.label === "At Risk" ? <AlertTriangle size={16} className="text-[var(--warning)]" /> : <Clock size={16} />}
              {group.label}
            </h2>
            <TaskList compact tasks={group.tasks} onDone={onDone} onSnooze={onSnooze} onFeedback={onFeedback} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function groupByDeadline(tasks: Task[], patterns?: Parameters<typeof scoreTask>[1]) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const buckets = [
    { label: "At Risk", tasks: [] as Task[] },
    { label: "Today", tasks: [] as Task[] },
    { label: "Tomorrow", tasks: [] as Task[] },
    { label: "This Week", tasks: [] as Task[] },
    { label: "Later", tasks: [] as Task[] },
    { label: "No Deadline", tasks: [] as Task[] }
  ];

  for (const task of tasks) {
    if (!task.deadline) {
      buckets[5].tasks.push(task);
      continue;
    }
    const due = new Date(task.deadline);
    const diff = due.getTime() - startOfDay(now).getTime();
    if (scoreTask(task, patterns) >= 80) buckets[0].tasks.push(task);
    else if (diff < day) buckets[1].tasks.push(task);
    else if (diff < day * 2) buckets[2].tasks.push(task);
    else if (diff < day * 7) buckets[3].tasks.push(task);
    else buckets[4].tasks.push(task);
  }

  return buckets.filter((bucket) => bucket.tasks.length > 0);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function nextMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}
