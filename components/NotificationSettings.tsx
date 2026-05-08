"use client";

import { Bell, Send, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { deleteNotificationChannel, loadNotificationChannels, saveNotificationChannel } from "@/lib/storage/notificationStore";
import type { NotificationChannel, NotificationChannelType } from "@/lib/types";

export function NotificationSettings() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [channelType, setChannelType] = useState<NotificationChannelType>("discord");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadNotificationChannels().then(setChannels);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!label.trim() || !target.trim()) return;

    const saved = await saveNotificationChannel({
      id: crypto.randomUUID(),
      channelType,
      label: label.trim(),
      target: target.trim(),
      enabled: true,
      createdAt: new Date().toISOString()
    });

    setChannels((current) => [saved, ...current]);
    setLabel("");
    setTarget("");
    setMessage("Channel saved.");
  }

  async function remove(channelId: string) {
    await deleteNotificationChannel(channelId);
    setChannels((current) => current.filter((channel) => channel.id !== channelId));
  }

  async function test(channel: NotificationChannel) {
    setMessage("Sending test...");
    const response = await fetch("/api/notifications/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel })
    });
    const payload = (await response.json()) as { ok: boolean; message: string };
    setMessage(payload.message);
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <Bell size={18} />
        <h2 className="font-semibold">Notification Channels</h2>
      </header>
      <div className="space-y-4 p-4">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Discord and Slack use webhook URLs. Email uses Resend when server env vars are configured. WhatsApp is saved for the provider integration pass.
        </p>
        <form className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto]" onSubmit={submit}>
          <select className="field" value={channelType} onChange={(event) => setChannelType(event.target.value as NotificationChannelType)}>
            <option value="discord">Discord</option>
            <option value="slack">Slack</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <input className="field" placeholder="Label" value={label} onChange={(event) => setLabel(event.target.value)} />
          <input className="field" placeholder={placeholderFor(channelType)} value={target} onChange={(event) => setTarget(event.target.value)} />
          <button className="btn btn-dark">Add</button>
        </form>

        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

        <div className="space-y-2">
          {channels.length === 0 ? <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">No notification channels yet.</div> : null}
          {channels.map((channel) => (
            <div key={channel.id} className="subtle-card flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{channel.label}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {channel.channelType} - {maskTarget(channel.target)}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-soft px-3" title="Send test" onClick={() => test(channel)}>
                  <Send size={16} />
                </button>
                <button className="btn btn-soft px-3" title="Delete" onClick={() => remove(channel.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function placeholderFor(channelType: NotificationChannelType) {
  if (channelType === "discord" || channelType === "slack") return "Webhook URL";
  if (channelType === "email") return "Email address";
  return "WhatsApp phone number";
}

function maskTarget(target: string) {
  if (target.startsWith("https://")) return `${target.slice(0, 28)}...`;
  const [name, domain] = target.split("@");
  if (domain) return `${name.slice(0, 2)}***@${domain}`;
  return `${target.slice(0, 4)}...`;
}
