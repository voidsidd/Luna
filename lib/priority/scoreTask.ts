import { patternAdjustment } from "@/lib/priority/userPatterns";
import type { Task, UserPatternSummary } from "@/lib/types";

export function scoreTask(task: Task, patterns?: UserPatternSummary) {
  const deadline = deadlinePressure(task.deadline);
  const impact = task.impact * 12;
  const effort = effortFit(task.effortMinutes);
  const energy = energyFit(task.energyRequired);
  const snoozePenalty = task.status === "snoozed" && task.snoozedUntil && new Date(task.snoozedUntil) > new Date() ? -35 : 0;
  const learnedAdjustment = patterns ? patternAdjustment(task, patterns) : 0;
  return clamp(Math.round(deadline + impact + effort + energy + snoozePenalty + learnedAdjustment), 0, 100);
}

export function explainTask(task: Task) {
  const parts: string[] = [];
  if (task.deadline) {
    const days = daysUntil(task.deadline);
    if (days < 0) parts.push("overdue");
    else if (days === 0) parts.push("due today");
    else if (days === 1) parts.push("due tomorrow");
    else if (days <= 7) parts.push(`due in ${days} days`);
  }
  if (task.impact >= 4) parts.push("high impact");
  if (task.effortMinutes && task.effortMinutes <= 25) parts.push("small enough to start quickly");
  if (task.energyRequired === "low") parts.push("low energy");
  if (parts.length === 0) return "Recommended because it is active and currently unblocked.";
  return `Recommended because it is ${parts.join(", ")}.`;
}

function deadlinePressure(deadline?: string) {
  if (!deadline) return 8;
  const days = daysUntil(deadline);
  if (days < 0) return 55;
  if (days === 0) return 48;
  if (days === 1) return 40;
  if (days <= 3) return 32;
  if (days <= 7) return 22;
  if (days <= 14) return 12;
  return 6;
}

function effortFit(minutes?: number) {
  if (!minutes) return 8;
  if (minutes <= 15) return 16;
  if (minutes <= 45) return 12;
  if (minutes <= 90) return 7;
  return 2;
}

function energyFit(energy: Task["energyRequired"]) {
  const hour = new Date().getHours();
  if (energy === "low") return hour >= 21 || hour < 9 ? 14 : 10;
  if (energy === "medium") return 8;
  return hour >= 9 && hour <= 20 ? 7 : 1;
}

function daysUntil(deadline: string) {
  const now = new Date();
  const due = new Date(deadline);
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
