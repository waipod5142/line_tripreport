"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ClipboardCheck,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Truck,
  Waypoints,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function Shell({
  children,
  reviewCount,
}: {
  children: React.ReactNode;
  reviewCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/trips", label: "Trips", icon: Truck },
    { href: "/reviews", label: "Review queue", icon: ClipboardCheck, badge: reviewCount },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const NavLinks = () => (
    <nav className="flex flex-col gap-0.5 px-2">
      {nav.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "group flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent-ink"
                : "text-ink-soft hover:bg-panel-2 hover:text-ink",
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active ? "text-accent" : "text-muted group-hover:text-ink-soft",
              )}
              strokeWidth={active ? 2.25 : 2}
            />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-accent px-1.5 text-2xs font-semibold text-white tabular">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-white">
        <Waypoints className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-ink">Trip Intelligence</div>
        <div className="text-2xs text-muted">GEOID (Thailand)</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-panel lg:flex">
        <Brand />
        <div className="mt-1 flex-1 overflow-y-auto pb-4">
          <NavLinks />
        </div>
        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-xs font-semibold text-ink-soft">
              WA
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-medium text-ink">
                Wai (Ops manager)
              </div>
              <div className="truncate text-2xs text-muted">waipody@gmail.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-panel">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-panel-2"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-1 flex-1 overflow-y-auto pb-4">
              <NavLinks />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded text-ink-soft hover:bg-panel-2 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              placeholder="Search shipment, plate, container, driver…"
              className="h-9 w-full rounded border border-line bg-panel pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-2xs text-muted sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-green)]" />
              AI worker healthy
            </span>
            <span className="text-2xs text-faint">Asia/Bangkok</span>
          </div>
        </header>
        <main className="mx-auto max-w-page px-4 py-6 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
