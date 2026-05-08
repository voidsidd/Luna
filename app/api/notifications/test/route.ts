import { NextResponse } from "next/server";
import { sendReminderToChannel } from "@/lib/notifications/send";
import type { NotificationChannel } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { channel?: NotificationChannel };
  const channel = body.channel;

  if (!channel) return NextResponse.json({ ok: false, message: "Missing channel." }, { status: 400 });
  if (!channel.enabled) return NextResponse.json({ ok: false, message: "Channel is disabled." }, { status: 400 });

  const result = await sendReminderToChannel(
    {
      id: "test",
      taskId: "test",
      remindAt: new Date().toISOString(),
      reminderType: "custom",
      status: "scheduled",
      createdAt: new Date().toISOString()
    },
    { id: "test", title: "Test reminder", category: "personal", status: "active", impact: 3, energyRequired: "low", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    channel
  );

  if (result.status === "sent") return NextResponse.json({ ok: true, message: "Test notification sent." });
  if (result.status === "failed") return NextResponse.json({ ok: false, message: result.message }, { status: 502 });

  return NextResponse.json({
    ok: false,
    message: result.message
  });
}
