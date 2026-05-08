import type { Task, TaskEvent, UserPatternSummary } from "@/lib/types";

export function summarizePatterns(events: TaskEvent[], tasks: Task[]): UserPatternSummary {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const summary: UserPatternSummary = {
    tiredHighEnergyCount: 0,
    hardLongTaskCount: 0,
    notNowByContext: {},
    snoozedTaskIds: {}
  };

  for (const event of events) {
    const task = taskById.get(event.taskId);
    if (!task) continue;

    if (event.eventType === "too_tired" && task.energyRequired === "high") summary.tiredHighEnergyCount += 1;
    if (event.eventType === "too_hard" && (task.effortMinutes ?? 0) >= 60) summary.hardLongTaskCount += 1;
    if (event.eventType === "not_now" && task.context) summary.notNowByContext[task.context] = (summary.notNowByContext[task.context] ?? 0) + 1;
    if (event.eventType === "snoozed") summary.snoozedTaskIds[task.id] = (summary.snoozedTaskIds[task.id] ?? 0) + 1;
  }

  return summary;
}

export function patternAdjustment(task: Task, patterns: UserPatternSummary) {
  let adjustment = 0;

  if (task.energyRequired === "high" && patterns.tiredHighEnergyCount >= 2) adjustment -= 6;
  if ((task.effortMinutes ?? 0) >= 60 && patterns.hardLongTaskCount >= 2) adjustment -= 5;
  if (task.context && (patterns.notNowByContext[task.context] ?? 0) >= 2) adjustment -= 4;

  const snoozes = patterns.snoozedTaskIds[task.id] ?? 0;
  if (snoozes >= 2 && task.deadline) adjustment += 8;
  else if (snoozes >= 2) adjustment -= 4;

  return adjustment;
}

export function adaptationHint(task: Task, patterns: UserPatternSummary) {
  if (task.energyRequired === "high" && patterns.tiredHighEnergyCount >= 2) {
    return "You have been pushing back high-energy work lately, so this may need a smaller first step.";
  }
  if ((task.effortMinutes ?? 0) >= 60 && patterns.hardLongTaskCount >= 2) {
    return "Long tasks have been harder to start recently; split this before doing the full thing.";
  }
  return null;
}
