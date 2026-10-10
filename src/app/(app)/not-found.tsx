import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileQuestion className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          That page or repository does not exist, or it is not one of the repositories you are
          tracking.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/repositories">Browse repositories</Link>
      </Button>
    </div>
  );
}
