import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink",
  secondary:
    "border border-line-strong bg-canvas text-ink-soft hover:bg-panel-2 hover:text-ink",
  ghost: "text-muted hover:bg-panel-2 hover:text-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
