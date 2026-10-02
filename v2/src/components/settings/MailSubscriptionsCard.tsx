"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { BellSimpleIcon } from "@phosphor-icons/react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import {
  EMAIL_PREFERENCES_PATH,
  MAIL_KINDS,
  subscriptionRows,
  type SubscriptionRow,
} from "@/lib/mailKinds";
import { SettingsCard } from "./SettingsCard";

/**
 * Alerts, the weekly digest and product news sent to the account's own
 * address. These are subscriber mail, set up from the site's pages rather than
 * here, so an account owner used to need the emailed preferences link to see
 * them. The list and its wording are the ones the emailed page uses
 * (`subscriptionRows`); turning something off goes through the same routine.
 * The weekly case summary has its own switch above, so it isn't repeated.
 */
export function MailSubscriptionsCard({ email }: { email: string }) {
  const state = useQuery(api.emailPrefs.mine);
  const turnOff = useMutation(api.emailPrefs.turnOffMine);
  const [busy, setBusy] = useState<string | null>(null);

  const off = async (row: SubscriptionRow) => {
    const key = `${row.kind}:${row.id ?? ""}`;
    setBusy(key);
    try {
      await turnOff({ kind: row.kind, id: row.id });
      toast(`${MAIL_KINDS[row.kind].one} turned off`, { description: row.detail });
    } catch {
      toast.error("That didn't save. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const grouped = state ? subscriptionRows(state) : null;
  const rows = grouped ? [...grouped.alerts, ...grouped.digests] : [];

  return (
    <SettingsCard
      icon={BellSimpleIcon}
      title="Alerts and digests"
      description={`Set up from the site's pages and sent to ${email}.`}
    >
      {state === undefined ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None on this address.{" "}
          <Link href={EMAIL_PREFERENCES_PATH} className="font-bold underline underline-offset-4 hover:text-primary">
            See what you can get
          </Link>
        </p>
      ) : (
        <ul className="divide-y-2 divide-border border-y-2 border-border">
          {rows.map((row) => {
            const key = `${row.kind}:${row.id ?? ""}`;
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{MAIL_KINDS[row.kind].one}</p>{" "}
                  <p className={`text-sm text-muted-foreground ${row.isCaseNumber ? "font-mono" : ""}`}>{row.detail}</p>
                </div>{" "}
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  loading={busy === key}
                  disabled={busy !== null}
                  onClick={() => off(row)}
                >
                  Turn off
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
}
