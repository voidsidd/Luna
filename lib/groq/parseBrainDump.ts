import type { BrainDumpParseResult, ParsedTaskDraft } from "@/lib/types";

const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

type CurrentTimeContext = {
  iso?: string;
  local?: string;
  timezone?: string;
  locale?: string;
};

export async function parseBrainDumpWithGroq(input: string, currentTime?: CurrentTimeContext): Promise<BrainDumpParseResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const serverNow = new Date();
  const timeContext = {
    iso: currentTime?.iso ?? serverNow.toISOString(),
    local: currentTime?.local ?? serverNow.toString(),
    timezone: currentTime?.timezone ?? "unknown",
    locale: currentTime?.locale ?? "unknown"
  };

  const response = await fetch(groqUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract tasks from a messy brain dump. Return JSON only with {\"tasks\": [...], \"clarifyingQuestions\": [...]}. Keep the user in control. Do not add motivational prose. Use ISO 8601 strings for deadlines when clear. Interpret relative deadlines such as today, tomorrow, tonight, next Friday, and in 2 hours using the supplied current time and timezone. Infer conservatively; if a deadline, requirement, or importance is unclear, omit it and add a short clarifying question."
        },
        {
          role: "user",
          content: `Current time context:
ISO: ${timeContext.iso}
Local: ${timeContext.local}
Timezone: ${timeContext.timezone}
Locale: ${timeContext.locale}

Brain dump:
${input}

Each task must include title, category, impact, effortMinutes, energyRequired, optional deadline, optional nextAction. Categories: competition, school, chore, personal, admin. Energy: low, medium, high. Impact: 1-5.

For competitions, applications, scholarships, hackathons, contests, and opportunities, also include when available: eventImportance 1-5, opportunityName, submissionUrl, requirements.

If the user mentions time/money/effort already spent, include sunkCostMinutes if it is time-based, but do not increase impact because of sunk cost. Prefer short concrete titles and next actions under 25 minutes.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return { tasks: [], clarifyingQuestions: [] };

  const parsed = JSON.parse(content) as { tasks?: Array<Record<string, unknown>>; clarifyingQuestions?: unknown[] };
  return {
    tasks: (parsed.tasks ?? []).map(coerceTask).filter((task) => task.title.length > 0),
    clarifyingQuestions: (parsed.clarifyingQuestions ?? []).filter((question): question is string => typeof question === "string").slice(0, 3)
  };
}

function coerceTask(raw: Record<string, unknown>): ParsedTaskDraft {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : undefined,
    deadline: typeof raw.deadline === "string" ? raw.deadline : undefined,
    category: ["competition", "school", "chore", "personal", "admin"].includes(String(raw.category)) ? (String(raw.category) as ParsedTaskDraft["category"]) : "personal",
    impact: clampImpact(Number(raw.impact)),
    eventImportance: clampOptionalImpact(raw.eventImportance),
    sunkCostMinutes: typeof raw.sunkCostMinutes === "number" ? raw.sunkCostMinutes : undefined,
    opportunityName: typeof raw.opportunityName === "string" ? raw.opportunityName : undefined,
    submissionUrl: typeof raw.submissionUrl === "string" ? raw.submissionUrl : undefined,
    requirements: typeof raw.requirements === "string" ? raw.requirements : undefined,
    effortMinutes: typeof raw.effortMinutes === "number" ? raw.effortMinutes : undefined,
    energyRequired: ["low", "medium", "high"].includes(String(raw.energyRequired)) ? (String(raw.energyRequired) as ParsedTaskDraft["energyRequired"]) : "medium",
    nextAction: typeof raw.nextAction === "string" ? raw.nextAction : undefined
  };
}

function clampOptionalImpact(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clampImpact(value);
}

function clampImpact(value: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
}
