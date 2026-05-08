import { NextResponse } from "next/server";
import { sendReminderToChannel } from "@/lib/notifications/send";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { NotificationChannel, Reminder, Task } from "@/lib/types";

type ManualDispatchBody = {
  reminders?: Reminder[];
  tasks?: Task[];
  channels?: NotificationChannel[];
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ManualDispatchBody;

  if (body.reminders && body.channels) {
    return dispatchManual(body);
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized dispatch request." }, { status: 401 });
  }

  return dispatchFromSupabase();
}

async function dispatchManual(body: ManualDispatchBody) {
  const reminders = (body.reminders ?? []).filter((reminder) => reminder.status === "scheduled" && new Date(reminder.remindAt) <= new Date());
  const tasks = body.tasks ?? [];
  const channels = (body.channels ?? []).filter((channel) => channel.enabled);

  const results = [];
  for (const reminder of reminders) {
    const task = tasks.find((item) => item.id === reminder.taskId);
    for (const channel of channels) {
      results.push(await sendReminderToChannel(reminder, task, channel));
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "manual",
    results,
    sentReminderIds: reminderIdsWithSentDelivery(results)
  });
}

async function dispatchFromSupabase() {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY is required for scheduled dispatch." }, { status: 501 });
  }

  const now = new Date().toISOString();
  const { data: reminders, error: reminderError } = await supabase.from("reminders").select("*").eq("status", "scheduled").lte("remind_at", now).limit(50);
  if (reminderError) return NextResponse.json({ ok: false, message: reminderError.message }, { status: 500 });

  const typedReminders = (reminders ?? []).map(reminderFromRow);
  if (typedReminders.length === 0) return NextResponse.json({ ok: true, mode: "scheduled", results: [], sentReminderIds: [] });

  const userIds = unique(typedReminders.map((reminder) => reminder.userId).filter(Boolean) as string[]);
  const taskIds = unique(typedReminders.map((reminder) => reminder.taskId));

  const { data: tasks } = await supabase.from("tasks").select("*").in("id", taskIds);
  const { data: channels } = await supabase.from("notification_channels").select("*").eq("enabled", true).in("user_id", userIds);

  const typedTasks = (tasks ?? []).map(taskFromRow);
  const typedChannels = (channels ?? []).map(channelFromRow);
  const results = [];

  for (const reminder of typedReminders) {
    const task = typedTasks.find((item) => item.id === reminder.taskId);
    const userChannels = typedChannels.filter((channel) => channel.userId === reminder.userId);
    for (const channel of userChannels) {
      const result = await sendReminderToChannel(reminder, task, channel);
      results.push(result);
      await supabase.from("notification_deliveries").insert({
        reminder_id: result.reminderId,
        channel_id: result.channelId,
        user_id: reminder.userId,
        status: result.status,
        error: result.status === "sent" ? null : result.message
      });
    }
  }

  const sentReminderIds = reminderIdsWithSentDelivery(results);
  if (sentReminderIds.length > 0) {
    await supabase.from("reminders").update({ status: "sent" }).in("id", sentReminderIds);
  }

  return NextResponse.json({ ok: true, mode: "scheduled", results, sentReminderIds });
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function reminderIdsWithSentDelivery(results: Array<{ reminderId: string; status: string }>) {
  return unique(results.filter((result) => result.status === "sent").map((result) => result.reminderId));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function reminderFromRow(row: Record<string, unknown>): Reminder {
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

function taskFromRow(row: Record<string, unknown>): Task {
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

function channelFromRow(row: Record<string, unknown>): NotificationChannel {
  return {
    id: String(row.id),
    userId: nullableString(row.user_id),
    channelType: String(row.channel_type) as NotificationChannel["channelType"],
    label: String(row.label),
    target: String(row.target),
    enabled: Boolean(row.enabled),
    createdAt: String(row.created_at)
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
