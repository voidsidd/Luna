export type TaskCategory = "competition" | "school" | "chore" | "personal" | "admin";
export type TaskStatus = "active" | "done" | "snoozed";
export type EnergyLevel = "low" | "medium" | "high";
export type TaskContext = "home" | "laptop" | "phone" | "outside";
export type TaskEventType = "created" | "completed" | "snoozed" | "too_tired" | "too_hard" | "not_now" | "split" | "edited";
export type NotificationChannelType = "email" | "discord" | "slack" | "whatsapp";

export type Task = {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  deadline?: string;
  category: TaskCategory;
  status: TaskStatus;
  impact: 1 | 2 | 3 | 4 | 5;
  effortMinutes?: number;
  energyRequired: EnergyLevel;
  context?: TaskContext;
  nextAction?: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
};

export type ParsedTaskDraft = Omit<Task, "id" | "status" | "createdAt" | "updatedAt"> & {
  sourceText?: string;
};

export type TaskEvent = {
  id: string;
  taskId: string;
  userId?: string;
  eventType: TaskEventType;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type UserPatternSummary = {
  tiredHighEnergyCount: number;
  hardLongTaskCount: number;
  notNowByContext: Partial<Record<TaskContext, number>>;
  snoozedTaskIds: Record<string, number>;
};

export type NotificationChannel = {
  id: string;
  userId?: string;
  channelType: NotificationChannelType;
  label: string;
  target: string;
  enabled: boolean;
  createdAt: string;
};

export type ReminderType = "deadline" | "start" | "followup" | "custom";
export type ReminderStatus = "scheduled" | "sent" | "dismissed";

export type Reminder = {
  id: string;
  taskId: string;
  userId?: string;
  remindAt: string;
  reminderType: ReminderType;
  status: ReminderStatus;
  createdAt: string;
};

export type NotificationDeliveryStatus = "sent" | "failed" | "skipped";

export type NotificationDelivery = {
  id: string;
  reminderId: string;
  channelId: string;
  userId?: string;
  status: NotificationDeliveryStatus;
  error?: string;
  createdAt: string;
};
