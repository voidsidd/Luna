import * as chrono from "chrono-node";
import type { ParsedTaskDraft, TaskCategory, EnergyLevel } from "@/lib/types";

const categoryHints: Array<[TaskCategory, RegExp]> = [
  ["competition", /\b(competition|hackathon|contest|application|scholarship|submission)\b/i],
  ["school", /\b(assignment|homework|exam|quiz|project|class|physics|math|college|school)\b/i],
  ["chore", /\b(laundry|clean|dishes|groceries|trash|cook|wash)\b/i],
  ["admin", /\b(email|form|document|bank|call|appointment|bill|register)\b/i]
];

export function parseBrainDump(input: string): ParsedTaskDraft[] {
  return splitInput(input)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((task) => task.title.length > 1);
}

function splitInput(input: string) {
  return input
    .split(/\n|;|(?:,\s+(?=(?:and\s+)?(?:need|finish|submit|apply|do|clean|wash|email|call|register|study|work)\b))/i)
    .flatMap((part) => part.split(/\s+\band\b\s+(?=(?:need|finish|submit|apply|do|clean|wash|email|call|register|study|work)\b)/i));
}

function parseLine(line: string): ParsedTaskDraft {
  const parsedDate = chrono.parseDate(line, new Date(), { forwardDate: true });
  const title = cleanTitle(line);
  const category = inferCategory(line);
  const effortMinutes = inferEffort(line, category);
  const energyRequired = inferEnergy(line, category);

  return {
    title,
    deadline: parsedDate?.toISOString(),
    category,
    impact: category === "competition" || category === "school" ? 4 : 3,
    effortMinutes,
    energyRequired,
    nextAction: inferNextAction(title, category),
    sourceText: line
  };
}

function cleanTitle(line: string) {
  return line
    .replace(/\b(i\s+)?(need to|have to|gotta|should|must)\b/gi, "")
    .replace(/\b(by|due|before|on)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[-*.\s]+/, "")
    .trim()
    .replace(/^[a-z]/, (letter) => letter.toUpperCase());
}

function inferCategory(line: string): TaskCategory {
  return categoryHints.find(([, pattern]) => pattern.test(line))?.[0] ?? "personal";
}

function inferEffort(line: string, category: TaskCategory) {
  const minutes = line.match(/\b(\d{1,3})\s?(min|mins|minutes)\b/i);
  if (minutes) return Number(minutes[1]);
  const hours = line.match(/\b(\d{1,2})\s?(hr|hrs|hour|hours)\b/i);
  if (hours) return Number(hours[1]) * 60;
  if (category === "chore" || category === "admin") return 20;
  if (category === "competition") return 90;
  return 45;
}

function inferEnergy(line: string, category: TaskCategory): EnergyLevel {
  if (/\b(email|call|laundry|dishes|trash|clean)\b/i.test(line)) return "low";
  if (category === "competition" || /\b(study|draft|build|solve|write)\b/i.test(line)) return "high";
  return "medium";
}

function inferNextAction(title: string, category: TaskCategory) {
  if (category === "competition") return "Open the rules or submission page and list the required pieces.";
  if (category === "school") return "Create the first rough outline or solve the first small section.";
  if (category === "chore") return "Set a 10 minute timer and start the physical first step.";
  if (category === "admin") return "Open the relevant message, form, or document.";
  return `Spend 10 minutes clarifying "${title}".`;
}
