import "server-only";
import { z } from "zod";

// Trip summariser (PRD §10.7). Distinct from extraction: it produces a concise
// rolling summary of a whole trip from its facts, events, and messages. Uses the
// same OpenRouter model (AI_MODEL). Tolerant Zod parse.

const SummarySchema = z.object({
  summaryThai: z.string().catch(""),
  summaryEnglish: z.string().catch(""),
});
export type TripSummary = z.infer<typeof SummarySchema>;

export interface SummariseInput {
  shipmentCode: string;
  route: string;
  status: string;
  driver: string | null;
  vehicles: string;
  plannedDelivery: string | null;
  events: string[];
  messages: string[];
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function summariseTrip(input: SummariseInput): Promise<TripSummary> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.AI_MODEL ?? "moonshotai/kimi-k3";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const system = [
    "You write concise operational summaries of cross-border (Thailand–Laos)",
    "truck transport trips for dispatchers.",
    'Return ONLY JSON: {"summaryThai": string, "summaryEnglish": string}.',
    "Each summary is 1–3 sentences. State confirmed facts plainly; if something",
    "important is unresolved, note it briefly. Use only the provided facts and",
    "messages — do not invent. summaryThai in Thai, summaryEnglish in English.",
  ].join(" ");

  const user = [
    `Shipment: ${input.shipmentCode}`,
    `Route: ${input.route}`,
    `Status: ${input.status}`,
    input.driver ? `Driver: ${input.driver}` : null,
    `Vehicles: ${input.vehicles}`,
    input.plannedDelivery ? `Planned delivery: ${input.plannedDelivery}` : null,
    input.events.length ? `Events (oldest first):\n${input.events.join("\n")}` : null,
    input.messages.length
      ? `Source messages (oldest first):\n${input.messages.join("\n")}`
      : null,
    "Write the JSON summary now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_TITLE ?? "LINE Trip Intelligence",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  return SummarySchema.parse(JSON.parse(content));
}
