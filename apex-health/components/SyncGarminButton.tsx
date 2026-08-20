"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/components/Toast";
import { formatRelativeTime } from "@/lib/format";

export function SyncGarminButton({ date }: { date?: string }) {
  const syncNow = useAction(api.garmin.syncNow);
  const status = useQuery(api.garminStore.syncStatus);
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const remoteRunning = status?.status === "running";
  const busy = syncing || remoteRunning;

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncNow(date === undefined ? {} : { date });
      if (!result.ok) {
        toast({
          tone: "error",
          title: "Garmin sync failed",
          body:
            result.error ??
            "The unofficial Garmin client could not sign in.",
          action: {
            label: "Enter today's data manually",
            href: "/dashboard/manual-entry",
          },
        });
        return;
      }
      if (result.warnings.length > 0) {
        toast({
          tone: "info",
          title: "Synced with gaps",
          body: `${result.warnings.length} metric(s) were unavailable from Garmin. Everything else is up to date.`,
          action: {
            label: "Enter data manually",
            href: "/dashboard/manual-entry",
          },
        });
      } else {
        toast({
          tone: "success",
          title: "Garmin data synced",
          body:
            result.activitiesAdded > 0
              ? `${result.activitiesAdded} new activity/activities imported.`
              : "All metrics up to date.",
        });
      }
    } catch (error) {
      toast({
        tone: "error",
        title: "Garmin sync failed",
        body:
          error instanceof Error
            ? error.message
            : "The unofficial Garmin client could not sign in.",
        action: {
          label: "Enter today's data manually",
          href: "/dashboard/manual-entry",
        },
      });
    } finally {
      setSyncing(false);
    }
  }

  function syncLabel(): string {
    if (status === undefined) {
      return "Checking sync status…";
    }
    if (busy) {
      return "Sync in progress…";
    }
    if (status.status === "error") {
      return status.lastError ?? "Last sync failed";
    }
    if (status.lastSyncedAt === null) {
      return "Never synced";
    }
    return `Last synced ${formatRelativeTime(status.lastSyncedAt, now)}`;
  }

  const labelTone =
    status?.status === "error"
      ? "text-apex-amber"
      : status?.lastSyncedAt === null && status !== undefined
        ? "text-slate-600"
        : "text-slate-500";

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleSync}
        disabled={busy}
        className="bg-apex-cyan hover:bg-apex-cyan-bright flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#04121f] transition-colors disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {busy ? "Syncing…" : "Sync Garmin Data"}
      </button>
      <p className={`max-w-xs text-right text-xs ${labelTone}`}>{syncLabel()}</p>
    </div>
  );
}
