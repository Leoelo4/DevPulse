import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Brand />
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileQuestion className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page you were looking for does not exist.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
