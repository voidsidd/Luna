import { patternAdjustment } from "@/lib/priority/userPatterns";
import type { Task, UserPatternSummary } from "@/lib/types";

export function scoreTask(task: Task, patterns?: UserPatternSummary) {
  const deadline = deadlinePressure(task.deadline);
  const importance = (task.eventImportance ?? task.impact) * 12;
  const impact = task.impact * 7;
  const effort = effortFit(task.effortMinutes);
  const energy = energyFit(task.energyRequired);
  const opportunity = opportunityBoost(task);
  const sunkCost = sunkCostPenalty(task);
  const snoozePenalty = task.status === "snoozed" && task.snoozedUntil && new Date(task.snoozedUntil) > new Date() ? -35 : 0;
  const learnedAdjustment = patterns ? patternAdjustment(task, patterns) : 0;
  return clamp(Math.round(deadline + importance + impact + opportunity + effort + energy + sunkCost + snoozePenalty + learnedAdjustment), 0, 100);
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
  if ((task.eventImportance ?? task.impact) >= 4) parts.push("important");
  if (task.sunkCostMinutes && task.sunkCostMinutes > 120 && (task.eventImportance ?? task.impact) <= 2) parts.push("but sunk cost is not treated as priority");
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

function opportunityBoost(task: Task) {
  if (task.category !== "competition") return 0;
  const importance = task.eventImportance ?? task.impact;
  return importance >= 4 ? 10 : 4;
}

function sunkCostPenalty(task: Task) {
  if (!task.sunkCostMinutes || task.sunkCostMinutes < 120) return 0;
  const importance = task.eventImportance ?? task.impact;
  return importance <= 2 ? -10 : 0;
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
