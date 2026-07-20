import "server-only";

import {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TripExtractionSchema,
  type TripExtraction,
} from "./schemas";
import { FEW_SHOT, buildSystemPrompt, buildUserPrompt } from "./prompts/extraction";

// Provider abstraction (PRD §16.4). Trip logic depends only on this interface,
// never on a provider-specific response object. The initial implementation
// targets OpenRouter (model configured via AI_MODEL, e.g. moonshotai/kimi-k3).

export interface ExtractionInput {
  messageText: string;
  attachmentText?: string;
  quotedText?: string;
  precedingMessages?: string[];
  candidateTripSummaries?: string[];
  locale: string;
  timezone: string;
}

export interface ExtractionResult {
  extraction: TripExtraction;
  model: string;
  provider: string;
  promptVersion: string;
  schemaVersion: string;
  latencyMs: number;
}

export interface TripExtractor {
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * OpenRouter-backed extractor. Returns a Zod-validated TripExtraction so
 * malformed model output is rejected before any application logic runs.
 * Not called from the UI-first scaffold yet — wired in with the async worker.
 */
export class OpenRouterExtractor implements TripExtractor {
  constructor(
    private readonly apiKey = process.env.OPENROUTER_API_KEY,
    private readonly model = process.env.AI_MODEL ?? "moonshotai/kimi-k3",
  ) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const started = Date.now();
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_TITLE ?? "LINE Trip Intelligence",
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(input.locale, input.timezone),
          },
          ...FEW_SHOT,
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    const extraction = TripExtractionSchema.parse(JSON.parse(content));

    return {
      extraction,
      model: this.model,
      provider: "openrouter",
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      latencyMs: Date.now() - started,
    };
  }
}
