// Versioned extraction prompt (PRD §16.3). Kept in source control; bump
// PROMPT_VERSION in lib/ai/schemas.ts when this changes and build a regression
// set before shipping a new version.
//
// v1.1: added Thai logistics vocabulary + few-shot examples so the model
// extracts route / vehicle / driver / container / schedule fields, not just the
// shipment code.

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
    "Formatting rules:",
    `- Locale ${locale}, timezone ${timezone}. Ambiguous numeric dates are DD/MM/YYYY.`,
    "- Convert a clearly Buddhist-Era year (e.g. 2569) to Gregorian (2026).",
    "- Emit dates as ISO (YYYY-MM-DD) and timestamps as ISO 8601 with +07:00.",
    "- Uppercase shipment codes. Preserve truck registrations as written.",
    "- classification is one of: trip_assignment, trip_update, trip_correction,",
    "  trip_cancellation, attachment_context, general_operational_notice,",
    "  non_operational, unknown.",
    `- eventType must be one of: ${EVENT_VOCABULARY.join(", ")}.`,
    "- confidence.overall and confidence.fields are numbers between 0 and 1.",
    "",
    "Thai logistics vocabulary — extract these fields whenever present:",
    "- Route 'A-B' or 'A ไป B' or 'A ปลายทาง B' → originName = A, destinationName = B.",
    "- ต้นทาง = origin; ปลายทาง = destination. Map the destination's Thai province to",
    "  destinationProvince (ชลบุรี=Chonburi, ระยอง=Rayong, อยุธยา=Ayutthaya, สระบุรี=Saraburi,",
    "  ปทุมธานี=Pathum Thani, มุกดาหาร=Mukdahan).",
    "- รถหัว / หัวลาก / หัว = tractorRegistration; หาง / พ่วง = trailerRegistration.",
    "- คนขับ = driverNameThai; เบอร์ / โทร = driverPhone.",
    "- ตู้ = loadedContainerNumber; ตู้เปล่า = emptyContainerNumber.",
    "- นัดส่ง / นัดลง = plannedDeliveryAt; วันที่มอบงาน = assignmentDate.",
    "- Event phrases: รับตู้=loaded_container_received, ผ่านด่านลาว=customs_lao_released,",
    "  ผ่านด่านไทย / ผ่านด่าน=customs_thai_released, ออกเดินทาง=departed_origin,",
    "  ถึง<place> / ถึงโรงงาน=arrived_destination, เริ่มลง=unloading_started,",
    "  ลงเสร็จ / ลงสินค้าเสร็จ=unloading_completed.",
    "- Populate confidence.overall high (~0.9) only when the shipment code and route",
    "  are clear; lower it when key fields are missing or ambiguous.",
  ].join("\n");
}

// Few-shot: two worked examples (assignment + status update). Sent as prior
// turns so the model mirrors the field mapping.
export const FEW_SHOT: { role: "user" | "assistant"; content: string }[] = [
  {
    role: "user",
    content:
      "CURRENT MESSAGE:\nงาน TPL7.7 มุกดาหาร-อมตะซิตี้ ชลบุรี รถหัว AYA 71-1234 หาง AYA 71-1235 คนขับสมชาย ใจดี เบอร์ 081-222-3333 ตู้ TCLU1234567 นัดส่ง 23/07/2026 08:00\n\nReturn the JSON extraction now.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      classification: "trip_assignment",
      language: ["th"],
      shipmentCode: "TPL7.7",
      assignmentDate: null,
      tractorRegistration: "AYA 71-1234",
      trailerRegistration: "AYA 71-1235",
      truckBrand: null,
      carrierCode: "AYA",
      driverNameThai: "สมชาย ใจดี",
      driverNameEnglish: null,
      driverPhone: "081-222-3333",
      originName: "Mukdahan",
      destinationName: "Amata City Chonburi",
      destinationProvince: "Chonburi",
      destinationMapUrl: null,
      plannedDeliveryAt: "2026-07-23T08:00:00+07:00",
      loadedContainerNumber: "TCLU1234567",
      emptyContainerNumber: null,
      events: [],
      latestStatusText: "Assigned: Mukdahan to Amata City Chonburi",
      summaryThai: "งาน TPL7.7 มุกดาหาร → อมตะซิตี้ ชลบุรี นัดส่ง 23/07 08:00",
      summaryEnglish: "TPL7.7 Mukdahan to Amata City Chonburi, delivery 23/07 08:00",
      referencedMessageId: null,
      corrections: [],
      confidence: { overall: 0.92, fields: {} },
      warnings: [],
    }),
  },
  {
    role: "user",
    content:
      "CURRENT MESSAGE:\nTPL7.7 รับตู้แล้ว ผ่านด่านมุกดาหาร กำลังไปชลบุรี\n\nReturn the JSON extraction now.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      classification: "trip_update",
      language: ["th"],
      shipmentCode: "TPL7.7",
      assignmentDate: null,
      tractorRegistration: null,
      trailerRegistration: null,
      truckBrand: null,
      carrierCode: null,
      driverNameThai: null,
      driverNameEnglish: null,
      driverPhone: null,
      originName: null,
      destinationName: null,
      destinationProvince: null,
      destinationMapUrl: null,
      plannedDeliveryAt: null,
      loadedContainerNumber: null,
      emptyContainerNumber: null,
      events: [
        { eventType: "loaded_container_received", eventAt: null, rawLabel: "รับตู้แล้ว", description: null },
        { eventType: "customs_thai_released", eventAt: null, rawLabel: "ผ่านด่านมุกดาหาร", description: null },
      ],
      latestStatusText: "Cleared Mukdahan border, en route to Chonburi",
      summaryThai: "TPL7.7 รับตู้ ผ่านด่าน กำลังไปชลบุรี",
      summaryEnglish: "TPL7.7 container received, cleared border, en route to Chonburi",
      referencedMessageId: null,
      corrections: [],
      confidence: { overall: 0.85, fields: {} },
      warnings: [],
    }),
  },
];

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
