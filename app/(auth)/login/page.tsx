import Link from "next/link";
import { ArrowRight, Waypoints } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between border-r border-line bg-panel p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-white">
            <Waypoints className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">Trip Intelligence</div>
            <div className="text-2xs text-muted">GEOID (Thailand)</div>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-2xl font-semibold leading-snug tracking-tight text-ink">
            From LINE chatter to a traceable trip database.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Assignments, border releases, arrivals and unloading — captured from your
            LINE groups, consolidated by shipment code, and laid out on one honest
            timeline.
          </p>

          {/* quiet journey motif */}
          <div className="mt-8 flex items-center gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-8 rounded-sm"
                style={{
                  backgroundColor: i < 5 ? "var(--accent)" : "var(--line-strong)",
                }}
              />
            ))}
          </div>
          <div className="mt-2 font-mono text-2xs tabular text-faint">
            TPL6.5 · Mukdahan → LG Rayong · in transit
          </div>
        </div>

        <p className="text-2xs text-faint">
          Authorized use only · Asia/Bangkok · v0.1 MVP
        </p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-white">
              <Waypoints className="h-5 w-5" strokeWidth={2.25} />
            </span>
          </div>

          <div className="eyebrow mb-1">Sign in</div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-muted">
            Use your GEOID operations account.
          </p>

          <form className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-ink-soft"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@geoid.co.th"
                className="h-10 w-full rounded border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-ink-soft"
                >
                  Password
                </label>
                <Link
                  href="#"
                  className="text-xs font-medium text-accent hover:text-accent-ink"
                >
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 w-full rounded border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
              />
            </div>

            <Link
              href="/dashboard"
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-ink"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </form>

          <p className="mt-6 text-center text-2xs text-faint">
            Protected by Supabase Auth · access limited to authorized organizations.
          </p>
        </div>
      </div>
    </div>
  );
}
