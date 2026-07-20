"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Mail, Waypoints } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) {
      setError("Sign-in failed or was cancelled. Please try again.");
    }
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  };

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

      {/* Auth controls */}
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
            Access is limited to authorized GEOID accounts.
          </p>

          {error && (
            <div className="mt-4 rounded border border-[var(--st-red)]/30 bg-[var(--st-red)]/8 px-3 py-2 text-xs text-[var(--st-red)]">
              {error}
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-3 rounded border border-line-strong bg-canvas text-sm font-medium text-ink transition-colors hover:bg-panel-2"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-2xs text-faint">
            <span className="h-px flex-1 bg-line" />
            OR
            <span className="h-px flex-1 bg-line" />
          </div>

          {status === "sent" ? (
            <div className="rounded-md border border-line bg-panel px-4 py-6 text-center">
              <Mail className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-2 text-sm font-medium text-ink">Check your email</p>
              <p className="mt-1 text-xs text-muted">
                We sent a sign-in link to{" "}
                <span className="font-medium text-ink-soft">{email}</span>.
              </p>
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-ink-soft"
                >
                  Email a sign-in link
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@geoid.co.th"
                  className="h-10 w-full rounded border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Send magic link"}
                {status !== "sending" && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-2xs text-faint">
            Protected by Supabase Auth · your session is scoped to your organization.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
