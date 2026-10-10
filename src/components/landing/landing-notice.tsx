import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * One-off messages after redirects (disconnect finished, connection expired, sign-in failed).
 * Driven by a fixed set of query values; unknown values render nothing, and no query text is ever
 * echoed into the page.
 */
export async function LandingNotice({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  if (first(params.disconnected) === "1") {
    return (
      <Alert>
        <CheckCircle2 aria-hidden />
        <AlertTitle>Disconnected</AlertTitle>
        <AlertDescription>
          Your DevPulse data was deleted and the GitHub authorization was revoked.
        </AlertDescription>
      </Alert>
    );
  }
  if (first(params.disconnected) === "partial") {
    return (
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertTitle>Disconnected, with one step to check</AlertTitle>
        <AlertDescription>
          Your DevPulse data was deleted, but GitHub did not confirm that the authorization was
          revoked. To be sure, remove DevPulse at{" "}
          <a
            className="underline underline-offset-4"
            href="https://github.com/settings/applications"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/settings/applications
          </a>
          .
        </AlertDescription>
      </Alert>
    );
  }
  if (first(params.reconnect) === "1") {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Your GitHub connection needs to be renewed</AlertTitle>
        <AlertDescription>
          GitHub rejected the stored access token (it may have expired or been revoked). Sign in
          again to continue.
        </AlertDescription>
      </Alert>
    );
  }
  if (first(params.auth_error) === "1") {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>GitHub sign-in did not complete</AlertTitle>
        <AlertDescription>
          The sign-in was cancelled or GitHub reported an error. Nothing was changed; you can try
          again.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
