"use client";

import { disconnectAccount } from "@/app/actions/live";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Disconnect with an explicit confirmation that spells out exactly what is deleted. */
export function DisconnectButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Disconnect GitHub…</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect and delete your data?</AlertDialogTitle>
          <AlertDialogDescription>
            This revokes DevPulse&apos;s access token at GitHub, signs you out, and permanently
            deletes your account, sessions, stored token and selected repositories from DevPulse.
            Nothing in your GitHub repositories is changed. You can connect again at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={disconnectAccount}>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              Disconnect and delete
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
