import type { NotificationChannel, NotificationDeliveryStatus, Reminder, Task } from "@/lib/types";

export type DispatchResult = {
  reminderId: string;
  channelId: string;
  status: NotificationDeliveryStatus;
  message: string;
};

export async function sendReminderToChannel(reminder: Reminder, task: Task | undefined, channel: NotificationChannel): Promise<DispatchResult> {
  if (!channel.enabled) return result(reminder, channel, "skipped", "Channel disabled.");

  const text = formatReminder(reminder, task);
  const subject = formatSubject(task);

  if (channel.channelType === "discord") {
    return sendWebhook(reminder, channel, { content: text });
  }

  if (channel.channelType === "slack") {
    return sendWebhook(reminder, channel, { text });
  }

  if (channel.channelType === "email") {
    return sendEmail(reminder, channel, subject, text, formatEmailHtml(reminder, task));
  }

  return result(reminder, channel, "skipped", `${channel.channelType} delivery needs a provider integration.`);
}

export function formatReminder(reminder: Reminder, task?: Task) {
  const title = task?.title ?? "Deleted task";
  const due = task?.deadline ? `\nDeadline: ${new Date(task.deadline).toLocaleString()}` : "";
  const action = task?.nextAction ? `\nStart with: ${task.nextAction}` : "";
  return `Priority Manager reminder: ${title}\nReminder type: ${reminder.reminderType}\nRemind at: ${new Date(reminder.remindAt).toLocaleString()}${due}${action}`;
}

async function sendWebhook(reminder: Reminder, channel: NotificationChannel, payload: Record<string, unknown>) {
  if (!channel.target.startsWith("https://")) return result(reminder, channel, "failed", "Webhook URL must start with https://.");

  try {
    const response = await fetch(channel.target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return result(reminder, channel, "failed", `Webhook failed with ${response.status}.`);
    return result(reminder, channel, "sent", "Sent.");
  } catch (error) {
    return result(reminder, channel, "failed", error instanceof Error ? error.message : "Webhook request failed.");
  }
}

async function sendEmail(reminder: Reminder, channel: NotificationChannel, subject: string, text: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) return result(reminder, channel, "skipped", "RESEND_API_KEY and EMAIL_FROM are required for email delivery.");
  if (!isLikelyEmail(channel.target)) return result(reminder, channel, "failed", "Email target is not a valid address.");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [channel.target],
        subject,
        text,
        html
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return result(reminder, channel, "failed", `Email failed with ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }

    return result(reminder, channel, "sent", "Sent.");
  } catch (error) {
    return result(reminder, channel, "failed", error instanceof Error ? error.message : "Email request failed.");
  }
}

function formatSubject(task?: Task) {
  return `Reminder: ${task?.title ?? "Task"}`;
}

function formatEmailHtml(reminder: Reminder, task?: Task) {
  const title = escapeHtml(task?.title ?? "Deleted task");
  const deadline = task?.deadline ? `<p><strong>Deadline:</strong> ${escapeHtml(new Date(task.deadline).toLocaleString())}</p>` : "";
  const nextAction = task?.nextAction ? `<p><strong>Start with:</strong> ${escapeHtml(task.nextAction)}</p>` : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #151816; line-height: 1.5;">
      <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #466149;">Priority Manager</p>
      <h1 style="font-size: 22px; margin: 0 0 12px;">${title}</h1>
      <p><strong>Reminder type:</strong> ${escapeHtml(reminder.reminderType)}</p>
      <p><strong>Remind at:</strong> ${escapeHtml(new Date(reminder.remindAt).toLocaleString())}</p>
      ${deadline}
      ${nextAction}
    </div>
  `;
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function result(reminder: Reminder, channel: NotificationChannel, status: NotificationDeliveryStatus, message: string): DispatchResult {
  return {
    reminderId: reminder.id,
    channelId: channel.id,
    status,
    message
  };
}
