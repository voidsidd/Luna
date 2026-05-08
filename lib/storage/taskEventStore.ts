import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/session";
import type { Task, TaskEvent, TaskEventType } from "@/lib/types";

const localKey = "priority-manager.task-events";

export async function loadTaskEvents(): Promise<TaskEvent[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("task_events").select("*").order("created_at", { ascending: false });
    if (!error && data) return data.map(fromRow);
    console.warn("Supabase event load failed, falling back to local storage.", error);
  }

  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(localKey);
  return raw ? (JSON.parse(raw) as TaskEvent[]) : [];
}

export async function recordTaskEvent(task: Task, eventType: TaskEventType, metadata: Record<string, unknown> = {}) {
  const event: TaskEvent = {
    id: crypto.randomUUID(),
    taskId: task.id,
    userId: task.userId,
    eventType,
    metadata,
    createdAt: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from("task_events").insert(toRow({ ...event, userId: event.userId ?? userId }));
    if (!error) return event;
    console.warn("Supabase event save failed, falling back to local storage.", error);
  }

  const events = await loadTaskEvents();
  persistLocal([event, ...events]);
  return event;
}

function persistLocal(events: TaskEvent[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(localKey, JSON.stringify(events));
}

function toRow(event: TaskEvent) {
  return {
    id: event.id,
    task_id: event.taskId,
    user_id: event.userId ?? null,
    event_type: event.eventType,
    metadata: event.metadata ?? {},
    created_at: event.createdAt
  };
}

function fromRow(row: Record<string, unknown>): TaskEvent {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: nullableString(row.user_id),
    eventType: String(row.event_type) as TaskEventType,
    metadata: typeof row.metadata === "object" && row.metadata !== null ? (row.metadata as Record<string, unknown>) : {},
    createdAt: String(row.created_at)
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
