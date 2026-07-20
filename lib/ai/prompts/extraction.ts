// Versioned extraction prompt (PRD §16.3). Kept in source control; bump
// PROMPT_VERSION in lib/ai/schemas.ts when this changes and build a regression
// set before shipping a new version.

export const EVENT_VOCABULARY = [
  "assignment_created",
  "arrived_origin",
  "loaded_container_received",
  "customs_lao_released",
  "customs_thai_released",
  "departed_origin",
  "arrived_destination",
  "loading_started",
  "loading_completed",
  "unloading_started",
  "unloading_completed",
  "trip_completed",
  "trip_cancelled",
  "status_note",
] as const;

export function buildSystemPrompt(locale: string, timezone: string): string {
  return [
    "You extract structured transport-trip data from Thai/English LINE messages",
    "used by a cross-border (Thailand–Laos) truck logistics team.",
    "",
    "Return ONLY a single JSON object matching the agreed schema. No prose, no",
    "markdown, no code fences. Use null for any field not present in the source.",
    "Never invent values. Never output SQL or database identifiers.",
    "",
    "Rules:",
    `- Locale ${locale}, timezone ${timezone}. Ambiguous numeric dates are DD/MM/YYYY.`,
    "- Convert a clearly Buddhist-Era year (e.g. 2569) to Gregorian (2026).",
    "- Emit dates as ISO (YYYY-MM-DD) and timestamps as ISO 8601 with the +07:00 offset.",
    "- Uppercase shipment codes. Preserve truck registrations as written.",
    "- classification is one of: trip_assignment, trip_update, trip_correction,",
    "  trip_cancellation, attachment_context, general_operational_notice,",
    "  non_operational, unknown.",
    `- eventType must be one of: ${EVENT_VOCABULARY.join(", ")}.`,
    "- confidence.overall and confidence.fields are numbers between 0 and 1.",
    "- Add a warning for any value you are unsure about (bad OCR, ambiguous date,",
    "  non-standard container number).",
  ].join("\n");
}

export function buildUserPrompt(input: {
  messageText: string;
  attachmentText?: string;
  quotedText?: string;
  precedingMessages?: string[];
  candidateTripSummaries?: string[];
}): string {
  const parts = [`CURRENT MESSAGE:\n${input.messageText}`];
  if (input.attachmentText)
    parts.push(`ATTACHMENT TEXT:\n${input.attachmentText}`);
  if (input.quotedText) parts.push(`QUOTED MESSAGE:\n${input.quotedText}`);
  if (input.precedingMessages?.length)
    parts.push(
      `RECENT MESSAGES (same group, oldest first):\n${input.precedingMessages.join("\n")}`,
    );
  if (input.candidateTripSummaries?.length)
    parts.push(
      `CANDIDATE EXISTING TRIPS (match against these before creating a new one):\n${input.candidateTripSummaries.join("\n")}`,
    );
  parts.push("Return the JSON extraction now.");
  return parts.join("\n\n");
}
