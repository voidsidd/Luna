import type { ParsedTaskDraft, Task } from "@/lib/types";

export function createTask(draft: ParsedTaskDraft): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    description: draft.description?.trim() || undefined,
    deadline: draft.deadline,
    category: draft.category,
    status: "active",
    impact: draft.impact,
    eventImportance: draft.eventImportance,
    sunkCostMinutes: draft.sunkCostMinutes,
    opportunityName: draft.opportunityName,
    submissionUrl: draft.submissionUrl,
    requirements: draft.requirements,
    effortMinutes: draft.effortMinutes,
    energyRequired: draft.energyRequired,
    context: draft.context,
    nextAction: draft.nextAction,
    createdAt: now,
    updatedAt: now
  };
}
