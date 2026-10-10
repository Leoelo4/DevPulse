import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scrollable bordered table frame with an accessible caption. */
export function DataTable({
  caption,
  minWidth = "min-w-[40rem]",
  children,
  className,
}: {
  caption: string;
  minWidth?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border bg-card", className)}>
      <table className={cn("w-full text-left text-sm", minWidth)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
  title,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={cn(
        "px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b bg-muted/40">
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-top",
        align === "right" && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}
