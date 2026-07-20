import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  ImageIcon,
  MapPin,
  PenLine,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Code, CodeChip } from "@/components/ui/code";
import { PageHeader } from "@/components/ui/page-header";
import { EventTimeline } from "@/components/trips/event-timeline";
import { JourneyRail } from "@/components/trips/journey-rail";
import { ReviewBadge, StatusPill } from "@/components/ui/status";
import { getTripById, getTripMessages } from "@/lib/data/trips";
import { ResummariseButton } from "@/components/trips/resummarise-button";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
// The Re-summarise server action calls kimi-k3 (~50s).
export const maxDuration = 60;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTripById(id);
  if (!trip) notFound();

  const messages = await getTripMessages(trip.id);
  const bytes = (n: number) =>
    n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;

  return (
    <>
      <Link
        href="/trips"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All trips
      </Link>

      <PageHeader
        eyebrow={trip.lineGroup.replace("GEOID • ", "")}
        title={trip.shipmentCode}
        description={`${trip.origin} → ${trip.destination}${
          trip.destinationProvince ? `, ${trip.destinationProvince}` : ""
        }`}
        actions={
          <>
            <ResummariseButton tripId={trip.id} />
            <Button variant="secondary" size="sm">
              <PenLine className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="secondary" size="sm">
              <Plus className="h-3.5 w-3.5" /> Add event
            </Button>
            <Button variant="primary" size="sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
            </Button>
          </>
        }
      />

      {/* Status + journey rail */}
      <Card className="mb-6">
        <CardBody>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <StatusPill status={trip.status} />
            <ReviewBadge state={trip.reviewState} />
            {trip.manualOverride && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <PenLine className="h-3 w-3" /> Status manually set
              </span>
            )}
            <span className="ml-auto text-xs text-faint">
              Updated {timeAgo(trip.lastUpdateAt)}
            </span>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[560px]">
              <JourneyRail status={trip.status} />
            </div>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
            {trip.latestStatusText}
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: timeline, messages, attachments */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Event timeline" />
            <CardBody>
              <EventTimeline events={trip.events} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Related LINE messages"
              action={
                <span className="text-xs text-muted tabular">
                  {messages.length} linked
                </span>
              }
            />
            <div className="divide-y divide-line">
              {messages.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-thai text-sm font-medium text-ink">
                      {m.senderName}
                    </span>
                    <span className="font-mono text-2xs tabular text-faint">
                      {formatDateTime(m.sentAt)}
                    </span>
                  </div>
                  {m.text && (
                    <p className="mt-1 font-thai text-sm text-ink-soft">{m.text}</p>
                  )}
                  {m.attachmentName && (
                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
                      <ImageIcon className="h-3.5 w-3.5" /> {m.attachmentName}
                    </div>
                  )}
                </div>
              ))}
              {messages.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted">
                  No linked messages yet.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Attachments"
              action={
                <span className="text-xs text-muted tabular">
                  {trip.attachments.length} files
                </span>
              }
            />
            <CardBody>
              {trip.attachments.length === 0 ? (
                <p className="text-sm text-muted">
                  No photos or files attached to this trip.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {trip.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="overflow-hidden rounded-md border border-line"
                    >
                      <div className="grid aspect-[4/3] place-items-center bg-panel-2 text-faint">
                        {a.kind === "image" ? (
                          <ImageIcon className="h-7 w-7" />
                        ) : (
                          <FileText className="h-7 w-7" />
                        )}
                      </div>
                      <div className="p-2">
                        <div className="truncate font-mono text-2xs text-ink-soft">
                          {a.filename}
                        </div>
                        <div className="mt-0.5 text-2xs text-faint">
                          {a.caption} · {bytes(a.sizeBytes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: details, summary, audit */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Trip details" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Field label="Shipment code">
                  <Code className="font-semibold">{trip.shipmentCode}</Code>
                </Field>
                <Field label="Assignment date">
                  <span className="tabular">{formatDate(trip.assignmentDate)}</span>
                </Field>
                <Field label="Carrier">{trip.carrierCode ?? "—"}</Field>
                <Field label="Tractor">
                  {trip.tractor ? <CodeChip>{trip.tractor}</CodeChip> : "—"}
                </Field>
                <Field label="Trailer">
                  {trip.trailer ? <CodeChip>{trip.trailer}</CodeChip> : "—"}
                </Field>
                <Field label="Truck brand">{trip.truckBrand ?? "—"}</Field>
                <Field label="Driver">
                  <div className="font-thai">{trip.driverNameThai ?? "—"}</div>
                  {trip.driverNameEnglish && (
                    <div className="text-xs text-muted">
                      {trip.driverNameEnglish}
                    </div>
                  )}
                </Field>
                <Field label="Phone">
                  <Code muted>{trip.driverPhone ?? "—"}</Code>
                </Field>
                <Field label="Loaded container">
                  {trip.loadedContainer ? (
                    <CodeChip>{trip.loadedContainer}</CodeChip>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Empty container">
                  {trip.emptyContainer ? (
                    <CodeChip>{trip.emptyContainer}</CodeChip>
                  ) : (
                    "—"
                  )}
                </Field>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Route & schedule" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Field label="Origin">{trip.origin}</Field>
                <Field label="Destination">
                  <div>{trip.destination}</div>
                  {trip.destinationProvince && (
                    <div className="text-xs text-muted">
                      {trip.destinationProvince}
                    </div>
                  )}
                </Field>
                <Field label="Planned delivery">
                  <span className="tabular">
                    {formatDateTime(trip.plannedDeliveryAt)}
                  </span>
                </Field>
                <Field label="Actual arrival">
                  <span className="tabular">
                    {formatDateTime(trip.actualArrivalAt)}
                  </span>
                </Field>
                <Field label="Completed">
                  <span className="tabular">{formatDateTime(trip.completedAt)}</span>
                </Field>
              </dl>
              {trip.destinationMapUrl && (
                <a
                  href={trip.destinationMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-ink"
                >
                  <MapPin className="h-3.5 w-3.5" /> Open destination map
                </a>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rolling summary" />
            <CardBody className="space-y-3">
              <div>
                <div className="eyebrow mb-1">ไทย</div>
                <p className="font-thai text-sm leading-relaxed text-ink-soft">
                  {trip.summaryTh}
                </p>
              </div>
              <div className="border-t border-line pt-3">
                <div className="eyebrow mb-1">English</div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {trip.summaryEn}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Audit & corrections" />
            <CardBody>
              <ol className="space-y-3 text-xs">
                <li className="flex gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
                  <div>
                    <div className="text-ink-soft">
                      Trip created from assignment message
                    </div>
                    <div className="text-faint">
                      System · {formatDateTime(trip.assignmentDate + "T16:20:00+07:00")}
                    </div>
                  </div>
                </li>
                {trip.manualOverride && (
                  <li className="flex gap-2.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--st-amber)]" />
                    <div>
                      <div className="text-ink-soft">
                        Status manually set to “{trip.status}”
                      </div>
                      <div className="text-faint">
                        Wai (Ops manager) · {timeAgo(trip.lastUpdateAt)}
                      </div>
                    </div>
                  </li>
                )}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
