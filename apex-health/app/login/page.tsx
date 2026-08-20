"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Activity, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      router.push("/dashboard");
    } catch {
      setError(
        flow === "signIn"
          ? "Could not sign in. Check your email and password."
          : "Could not create that account. Password must be at least 8 characters.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="border-apex-border bg-apex-card flex h-11 w-11 items-center justify-center rounded-xl border">
            <Activity className="text-apex-cyan h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-slate-100 uppercase">
              Apex Health
            </h1>
            <p className="text-sm text-slate-500">
              {flow === "signIn" ? "Sign in to continue" : "Create your account"}
            </p>
          </div>
        </div>

        <form
          method="post"
          onSubmit={handleSubmit}
          className="border-apex-border bg-apex-card space-y-4 rounded-2xl border p-6"
        >
          <label className="block">
            <span className="text-xs tracking-wide text-slate-400 uppercase">
              Email
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="border-apex-border focus:border-apex-cyan mt-2 w-full rounded-lg border bg-[#0a0e1a] px-3 py-2 text-slate-100 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs tracking-wide text-slate-400 uppercase">
              Password
            </span>
            <input
              name="password"
              type="password"
              autoComplete={
                flow === "signIn" ? "current-password" : "new-password"
              }
              required
              className="border-apex-border focus:border-apex-cyan mt-2 w-full rounded-lg border bg-[#0a0e1a] px-3 py-2 text-slate-100 outline-none"
            />
          </label>

          {error !== null && (
            <p className="text-apex-red text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-apex-cyan flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-[#04121f] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {flow === "signIn" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setError(null);
            }}
            className="hover:text-apex-cyan w-full text-center text-sm text-slate-500"
          >
            {flow === "signIn"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
