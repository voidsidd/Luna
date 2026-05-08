import { getCurrentUserId } from "@/lib/auth/session";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Reminder } from "@/lib/types";

const localKey = "priority-manager.reminders";

export async function loadReminders(): Promise<Reminder[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("reminders").select("*").order("remind_at", { ascending: true });
    if (!error && data) return data.map(fromRow);
    console.warn("Supabase reminder load failed, falling back to local storage.", error);
  }

  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(localKey);
  return raw ? (JSON.parse(raw) as Reminder[]) : [];
}

export async function saveReminder(reminder: Reminder): Promise<Reminder> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from("reminders").upsert(toRow({ ...reminder, userId: reminder.userId ?? userId })).select("*").single();
    if (!error && data) return fromRow(data);
    console.warn("Supabase reminder save failed, falling back to local storage.", error);
  }

  const reminders = await loadReminders();
  const exists = reminders.some((item) => item.id === reminder.id);
  const next = exists ? reminders.map((item) => (item.id === reminder.id ? reminder : item)) : [reminder, ...reminders];
  persistLocal(next);
  return reminder;
}

export async function dismissReminder(reminder: Reminder): Promise<Reminder> {
  return saveReminder({ ...reminder, status: "dismissed" });
}

export async function markReminderSent(reminder: Reminder): Promise<Reminder> {
  return saveReminder({ ...reminder, status: "sent" });
}

function persistLocal(reminders: Reminder[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(localKey, JSON.stringify(reminders));
}

function toRow(reminder: Reminder) {
  return {
    id: reminder.id,
    task_id: reminder.taskId,
    user_id: reminder.userId ?? null,
    remind_at: reminder.remindAt,
    reminder_type: reminder.reminderType,
    status: reminder.status,
    created_at: reminder.createdAt
  };
}

function fromRow(row: Record<string, unknown>): Reminder {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: nullableString(row.user_id),
    remindAt: String(row.remind_at),
    reminderType: String(row.reminder_type ?? "custom") as Reminder["reminderType"],
    status: String(row.status ?? "scheduled") as Reminder["status"],
    createdAt: String(row.created_at)
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
