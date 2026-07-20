import { z } from "zod";

// Versioned extraction contract (PRD §10.3 / §16.3). The AI must return JSON
// that validates against this schema. It never produces SQL or DB identifiers.

export const SCHEMA_VERSION = "1.0";
export const PROMPT_VERSION = "1.1";

export const ClassificationEnum = z.enum([
  "trip_assignment",
  "trip_update",
  "trip_correction",
  "trip_cancellation",
  "attachment_context",
  "general_operational_notice",
  "non_operational",
  "unknown",
]);

// Tolerant of partial model output: real LLMs omit keys they have no value for,
// so every optional field defaults to null / [] rather than being required. Only
// classification and confidence carry sensible fallbacks. Coercion (e.g. a bare
// string for a nullable field) keeps validation from failing on cosmetics.
const nullableString = z.string().nullable().optional().default(null);

export const TripExtractionSchema = z.object({
  classification: ClassificationEnum.optional().default("unknown"),
  language: z.array(z.string()).optional().default([]),
  shipmentCode: nullableString,
  assignmentDate: nullableString, // ISO date
  tractorRegistration: nullableString,
  trailerRegistration: nullableString,
  truckBrand: nullableString,
  carrierCode: nullableString,
  driverNameThai: nullableString,
  driverNameEnglish: nullableString,
  driverPhone: nullableString,
  originName: nullableString,
  destinationName: nullableString,
  destinationProvince: nullableString,
  destinationMapUrl: nullableString,
  plannedDeliveryAt: nullableString, // ISO timestamp w/ tz
  loadedContainerNumber: nullableString,
  emptyContainerNumber: nullableString,
  events: z
    .array(
      z.object({
        eventType: z.string(),
        eventAt: z.string().nullable().optional().default(null),
        rawLabel: z.string().optional().default(""),
        description: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
  latestStatusText: nullableString,
  summaryThai: nullableString,
  summaryEnglish: nullableString,
  referencedMessageId: nullableString,
  corrections: z
    .array(
      z.object({
        field: z.string(),
        previousValue: z.string().nullable().optional().default(null),
        proposedValue: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
  confidence: z
    .object({
      overall: z.number().min(0).max(1).catch(0),
      // Some models emit a bare number here instead of a per-field map.
      fields: z.record(z.number()).catch({}),
    })
    .catch({ overall: 0, fields: {} }),
  warnings: z.array(z.string()).optional().default([]),
});

export type TripExtraction = z.infer<typeof TripExtractionSchema>;
