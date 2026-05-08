import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/session";
import type { Task } from "@/lib/types";

const localKey = "priority-manager.tasks";

export async function loadTasks(): Promise<Task[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (!error && data) return data.map(fromRow);
    console.warn("Supabase load failed, falling back to local storage.", error);
  }

  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(localKey);
  return raw ? (JSON.parse(raw) as Task[]) : [];
}

export async function saveTask(task: Task): Promise<Task> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from("tasks").upsert(toRow({ ...task, userId: task.userId ?? userId })).select("*").single();
    if (!error && data) return fromRow(data);
    console.warn("Supabase save failed, falling back to local storage.", error);
  }

  const tasks = await loadTasks();
  const exists = tasks.some((item) => item.id === task.id);
  const next = exists ? tasks.map((item) => (item.id === task.id ? task : item)) : [task, ...tasks];
  persistLocal(next);
  return task;
}

export async function updateTask(task: Task): Promise<Task> {
  return saveTask(task);
}

function persistLocal(tasks: Task[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(localKey, JSON.stringify(tasks));
}

function toRow(task: Task) {
  return {
    id: task.id,
    user_id: task.userId ?? null,
    title: task.title,
    description: task.description ?? null,
    deadline: task.deadline ?? null,
    category: task.category,
    status: task.status,
    impact: task.impact,
    effort_minutes: task.effortMinutes ?? null,
    energy_required: task.energyRequired,
    context: task.context ?? null,
    next_action: task.nextAction ?? null,
    snoozed_until: task.snoozedUntil ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
}

function fromRow(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    userId: nullableString(row.user_id),
    title: String(row.title),
    description: nullableString(row.description),
    deadline: nullableString(row.deadline),
    category: String(row.category ?? "personal") as Task["category"],
    status: String(row.status ?? "active") as Task["status"],
    impact: Number(row.impact ?? 3) as Task["impact"],
    effortMinutes: nullableNumber(row.effort_minutes),
    energyRequired: String(row.energy_required ?? "medium") as Task["energyRequired"],
    context: nullableString(row.context) as Task["context"],
    nextAction: nullableString(row.next_action),
    snoozedUntil: nullableString(row.snoozed_until),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
