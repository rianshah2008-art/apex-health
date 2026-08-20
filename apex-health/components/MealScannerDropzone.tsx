"use client";

import { DragEvent, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/components/Toast";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

type PendingMeal = {
  storageId: Id<"_storage">;
  description: string;
  calories: number;
  proteinG: number;
  rawText?: string;
};

export function MealScannerDropzone({
  date,
  disabled = false,
}: {
  date: string;
  disabled?: boolean;
}) {
  const generateUploadUrl = useMutation(api.nutrition.generateUploadUrl);
  const analyzeMealPhoto = useAction(api.meals.analyzeMealPhoto);
  const logMeal = useMutation(api.nutrition.logMeal);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingMeal | null>(null);
  const [saving, setSaving] = useState(false);

  useBodyScrollLock(pending !== null);

  async function processFile(file: File) {
    if (disabled) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({
        tone: "error",
        title: "Invalid file",
        body: "Please upload an image file.",
      });
      return;
    }

    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Could not upload photo");
      }
      const { storageId } = (await uploadResponse.json()) as {
        storageId: Id<"_storage">;
      };

      const result = await analyzeMealPhoto({ storageId });
      if (result.ok) {
        setPending({
          storageId,
          description: result.description,
          calories: result.calories,
          proteinG: result.proteinG,
        });
      } else {
        setPending({
          storageId,
          description: "",
          calories: 0,
          proteinG: 0,
          rawText: result.rawText,
        });
      }
    } catch (error) {
      toast({
        tone: "error",
        title: "Meal scan failed",
        body:
          error instanceof Error
            ? error.message
            : "Could not analyze the photo.",
      });
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      void processFile(file);
    }
  }

  async function confirmMeal() {
    if (pending === null) {
      return;
    }
    setSaving(true);
    try {
      await logMeal({
        date,
        photoStorageId: pending.storageId,
        description:
          pending.description.trim().length > 0
            ? pending.description.trim()
            : undefined,
        calories: pending.calories,
        proteinG: pending.proteinG,
      });
      toast({
        tone: "success",
        title: "Meal logged",
        body: `${pending.calories} kcal · ${pending.proteinG}g protein added to today.`,
      });
      setPending(null);
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not log meal",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={`border-apex-border bg-apex-card rounded-2xl border p-6 transition-colors ${
          dragging ? "border-apex-cyan bg-apex-cyan/5" : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {disabled && (
          <p className="text-apex-amber mb-4 text-sm">
            Log your weight first to track meals against today&apos;s targets.
          </p>
        )}
        <div className="mb-4 flex items-center gap-3">
          <span className="border-apex-border flex h-9 w-9 items-center justify-center rounded-lg border bg-[#0a0e1a]">
            <Camera className="text-apex-cyan h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xs tracking-wide text-slate-400 uppercase">
              AI Photo Meal Scanner
            </h3>
            <p className="text-sm text-slate-500">
              AI will estimate calories & macros for lean bulk
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
          className="border-apex-border hover:border-apex-cyan/50 flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="text-apex-cyan mb-3 h-8 w-8 animate-spin" />
              <p className="text-sm text-slate-300">Analyzing meal photo…</p>
            </>
          ) : (
            <>
              <Upload className="mb-3 h-8 w-8 text-slate-500" />
              <p className="text-sm font-medium text-slate-200">
                Drop meal photo here or click to upload
              </p>
              <p className="mt-1 text-xs text-slate-500">
                JPEG or PNG · vision estimate, editable before saving
              </p>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              void processFile(file);
            }
            event.target.value = "";
          }}
        />
      </div>

      {pending !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setPending(null)}
          role="presentation"
        >
          <div
            className="border-apex-border bg-apex-card w-full max-w-md rounded-2xl border p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-confirm-title"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="meal-confirm-title"
                  className="text-lg font-semibold text-slate-100"
                >
                  Confirm meal estimate
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Adjust calories or protein if the AI guess looks off.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="border-apex-border rounded-lg border p-2 text-slate-400 hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {pending.rawText !== undefined && (
              <p className="border-apex-amber/30 bg-apex-amber/10 text-apex-amber mb-4 rounded-lg border p-3 text-sm">
                AI returned unstructured text — enter values manually below.
                <span className="mt-2 block text-xs text-slate-400">
                  {pending.rawText}
                </span>
              </p>
            )}

            <label className="mb-3 block text-sm text-slate-400">
              Description
              <input
                type="text"
                value={pending.description}
                onChange={(event) =>
                  setPending({ ...pending, description: event.target.value })
                }
                className="border-apex-border bg-apex-bg mt-1 w-full rounded-lg border px-3 py-2 text-slate-100"
              />
            </label>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Calories
                <input
                  type="number"
                  min={0}
                  value={pending.calories}
                  onChange={(event) =>
                    setPending({
                      ...pending,
                      calories: Number(event.target.value),
                    })
                  }
                  className="border-apex-border bg-apex-bg mt-1 w-full rounded-lg border px-3 py-2 text-slate-100"
                />
              </label>
              <label className="text-sm text-slate-400">
                Protein (g)
                <input
                  type="number"
                  min={0}
                  value={pending.proteinG}
                  onChange={(event) =>
                    setPending({
                      ...pending,
                      proteinG: Number(event.target.value),
                    })
                  }
                  className="border-apex-border bg-apex-bg mt-1 w-full rounded-lg border px-3 py-2 text-slate-100"
                />
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="border-apex-border flex-1 rounded-full border px-4 py-2 text-sm font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmMeal()}
                className="bg-apex-cyan hover:bg-apex-cyan-bright flex-1 rounded-full px-4 py-2 text-sm font-semibold text-[#04121f] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Log meal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
