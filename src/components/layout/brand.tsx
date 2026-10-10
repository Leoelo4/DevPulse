import Link from "next/link";
import { cn } from "@/lib/utils";

/** The DevPulse mark: a heartbeat line in a rounded square. Purely geometric; no external assets. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      role="img"
      aria-label="DevPulse logo"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M5 17h5l3-7 4 13 3-9 2 3h5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 rounded-md font-semibold tracking-tight", className)}
    >
      <BrandMark />
      <span>DevPulse</span>
    </Link>
  );
}
