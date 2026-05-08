import { explainTask, scoreTask } from "@/lib/priority/scoreTask";
import { adaptationHint } from "@/lib/priority/userPatterns";
import type { Task, UserPatternSummary } from "@/lib/types";

export function recommendNextTask(tasks: Task[], patterns?: UserPatternSummary) {
  const eligible = tasks.filter((task) => {
    if (task.status === "done") return false;
    if (!task.snoozedUntil) return true;
    return new Date(task.snoozedUntil) <= new Date();
  });

  const best = eligible
    .map((task) => ({
      task,
      score: scoreTask(task, patterns),
      reason: [explainTask(task), patterns ? adaptationHint(task, patterns) : null].filter(Boolean).join(" ")
    }))
    .sort((a, b) => b.score - a.score)[0];
  return best ?? null;
}
