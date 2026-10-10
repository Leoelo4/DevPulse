import { Globe, Lock, ShieldAlert } from "lucide-react";
import { requestPrivateAccess } from "@/app/actions/live";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Explains what DevPulse can see with the current authorization and offers the (explicit,
 * separate) opt-in to private repositories.
 */
export function AccessCard({
  privateAccess,
  userName,
}: {
  privateAccess: boolean;
  userName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub access</CardTitle>
        <CardDescription>
          Signed in as <strong className="font-medium text-foreground">{userName}</strong>. DevPulse
          only ever reads data; it never writes to GitHub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-sm">
          {privateAccess ? (
            <>
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-medium">Public and private repositories.</strong> You
                granted GitHub&apos;s <code className="rounded bg-muted px-1 text-xs">repo</code>{" "}
                scope.
              </span>
            </>
          ) : (
            <>
              <Globe className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                <strong className="font-medium">Public repositories only.</strong> DevPulse holds a
                token with no scopes, which can read public data and nothing else.
              </span>
            </>
          )}
        </p>

        {!privateAccess ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-medium">Want private repositories?</strong> GitHub&apos;s
                OAuth <code className="rounded bg-muted px-1 text-xs">repo</code> scope is broad: it
                also technically allows writes, even though DevPulse only reads. If that is too
                much, run your own DevPulse with a GitHub App for fine-grained read-only access (see
                the README).
              </span>
            </p>
            <form action={requestPrivateAccess}>
              <Button type="submit" variant="outline">
                Enable private repositories
              </Button>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
