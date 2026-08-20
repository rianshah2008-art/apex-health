import Link from "next/link";
import { ReactNode } from "react";

/** Shared banner when a section has no Garmin/manual data for today. */
export function EmptyStateBanner({
  message,
  action,
}: {
  message: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="border-apex-border bg-apex-card mb-6 rounded-2xl border p-4 text-sm text-slate-400">
      {message}
      {action !== undefined && (
        <>
          {" "}
          <Link
            href={action.href}
            className="text-apex-cyan hover:text-apex-cyan-bright"
          >
            {action.label}
          </Link>
        </>
      )}
    </div>
  );
}
