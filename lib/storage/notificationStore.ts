import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/session";
import type { NotificationChannel } from "@/lib/types";

const localKey = "priority-manager.notification-channels";

export async function loadNotificationChannels(): Promise<NotificationChannel[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("notification_channels").select("*").order("created_at", { ascending: false });
    if (!error && data) return data.map(fromRow);
    console.warn("Supabase notification channel load failed, falling back to local storage.", error);
  }

  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(localKey);
  return raw ? (JSON.parse(raw) as NotificationChannel[]) : [];
}

export async function saveNotificationChannel(channel: NotificationChannel): Promise<NotificationChannel> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from("notification_channels").upsert(toRow({ ...channel, userId: channel.userId ?? userId })).select("*").single();
    if (!error && data) return fromRow(data);
    console.warn("Supabase notification channel save failed, falling back to local storage.", error);
  }

  const channels = await loadNotificationChannels();
  const exists = channels.some((item) => item.id === channel.id);
  const next = exists ? channels.map((item) => (item.id === channel.id ? channel : item)) : [channel, ...channels];
  persistLocal(next);
  return channel;
}

export async function deleteNotificationChannel(channelId: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("notification_channels").delete().eq("id", channelId);
    if (!error) return;
    console.warn("Supabase notification channel delete failed, falling back to local storage.", error);
  }

  const channels = await loadNotificationChannels();
  persistLocal(channels.filter((channel) => channel.id !== channelId));
}

function persistLocal(channels: NotificationChannel[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(localKey, JSON.stringify(channels));
}

function toRow(channel: NotificationChannel) {
  return {
    id: channel.id,
    user_id: channel.userId ?? null,
    channel_type: channel.channelType,
    label: channel.label,
    target: channel.target,
    enabled: channel.enabled,
    created_at: channel.createdAt
  };
}

function fromRow(row: Record<string, unknown>): NotificationChannel {
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
