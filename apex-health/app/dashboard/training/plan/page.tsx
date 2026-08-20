"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Bike,
  Calendar,
  ChevronDown,
  Dumbbell,
  Footprints,
  Loader2,
  Moon,
  RefreshCw,
  Target,
  Waves,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyStateBanner } from "@/components/EmptyStateBanner";
import { PageHeader } from "@/components/PageHeader";
import { PlanPhaseBadge } from "@/components/PlanPhaseBadge";
import { useToast } from "@/components/Toast";
import { formatLongDate, formatShortDate, todayKey } from "@/lib/dates";
import {
  currentPlanWeek,
  daysUntilEvent,
  defaultEventDateKey,
  disciplineLabel,
  EVENT_TYPE_OPTIONS,
  EventType,
} from "@/lib/trainingPlan";

const DISCIPLINE_ICONS: Record<string, typeof Waves> = {
  swim: Waves,
  bike: Bike,
  run: Footprints,
  strength: Dumbbell,
  rest: Moon,
  brick: Bike,
};

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-apex-border bg-apex-card rounded-2xl border p-6">
      <h2 className="mb-4 text-xs tracking-wide text-slate-400 uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function fieldClassName() {
  return "border-apex-border w-full rounded-xl border bg-[#0a0e1a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-apex-cyan/60";
}

function PlanEventForm({
  initialHeightIn,
}: {
  initialHeightIn?: number;
}) {
  const generateTrainingPlan = useAction(api.trainingPlanGen.generateTrainingPlan);
  const toast = useToast();

  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<EventType>("half_ironman");
  const [eventDate, setEventDate] = useState(defaultEventDateKey());
  const [heightIn, setHeightIn] = useState(
    initialHeightIn !== undefined ? String(initialHeightIn) : "",
  );
  const [generating, setGenerating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      toast({
        tone: "error",
        title: "Event name required",
        body: "Give your target race a name.",
      });
      return;
    }

    const parsedHeight = heightIn.trim().length > 0 ? Number(heightIn) : undefined;
    if (
      parsedHeight !== undefined &&
      (!Number.isFinite(parsedHeight) || parsedHeight <= 0)
    ) {
      toast({
        tone: "error",
        title: "Invalid height",
        body: "Enter height in inches, or leave blank.",
      });
      return;
    }

    setGenerating(true);
    try {
      const result = await generateTrainingPlan({
        name: trimmedName,
        eventType,
        eventDate,
        heightIn: parsedHeight,
      });

      if (!result.ok) {
        toast({
          tone: "error",
          title: "Plan generation failed",
          body: result.error,
        });
        return;
      }

      toast({
        tone: "success",
        title: "Training plan generated",
        body: "Your periodized plan is ready to review.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Plan generation failed",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SectionCard title="Create your event">
      <p className="mb-4 text-sm text-slate-500">
        Enter a target race and Apex will build a periodized plan from your
        current Garmin fitness data.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm text-slate-400">Event name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ironman Coeur d'Alene"
            className={fieldClassName()}
            disabled={generating}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-slate-400">Event type</span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className={fieldClassName()}
            disabled={generating}
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-slate-400">Event date</span>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={fieldClassName()}
            disabled={generating}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-slate-400">Height (inches)</span>
          <input
            type="number"
            min={1}
            step={0.5}
            value={heightIn}
            onChange={(e) => setHeightIn(e.target.value)}
            placeholder="70"
            className={fieldClassName()}
            disabled={generating}
          />
        </label>

        <button
          type="submit"
          disabled={generating}
          className="bg-apex-cyan hover:bg-apex-cyan/90 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0a0e1a] transition-colors disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating plan…
            </>
          ) : (
            <>
              <Target className="h-4 w-4" />
              Generate training plan
            </>
          )}
        </button>
      </form>
    </SectionCard>
  );
}

function WeekAccordion({
  weeks,
  currentWeekNumber,
}: {
  weeks: Array<{
    weekStartDate: string;
    weekNumber: number;
    phase: string;
    targetHours: number;
    workouts: Array<{
      day: string;
      discipline: string;
      description: string;
      durationMin?: number;
    }>;
    notes?: string;
  }>;
  currentWeekNumber: number | null;
}) {
  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => a.weekNumber - b.weekNumber),
    [weeks],
  );
  const [expandedWeek, setExpandedWeek] = useState<number | null>(
    currentWeekNumber,
  );

  return (
    <div className="space-y-2">
      {sortedWeeks.map((week) => {
        const isCurrent = week.weekNumber === currentWeekNumber;
        const expanded = expandedWeek === week.weekNumber;
        return (
          <div
            key={week.weekNumber}
            className={`border-apex-border overflow-hidden rounded-xl border ${
              isCurrent ? "border-apex-cyan/40 bg-apex-cyan/5" : "bg-[#0a0e1a]"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedWeek(expanded ? null : week.weekNumber)
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">
                  Week {week.weekNumber}
                </span>
                <PlanPhaseBadge phase={week.phase} highlighted={isCurrent} />
                <span className="text-xs text-slate-500">
                  {formatShortDate(week.weekStartDate)} · {week.targetHours}h
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {expanded && (
              <div className="border-apex-border space-y-3 border-t px-4 py-3">
                {week.notes !== undefined && week.notes.length > 0 && (
                  <p className="text-sm text-slate-400">{week.notes}</p>
                )}
                <ul className="space-y-2">
                  {week.workouts.map((workout, index) => {
                    const Icon = DISCIPLINE_ICONS[workout.discipline] ?? Footprints;
                    return (
                      <li
                        key={`${workout.day}-${index}`}
                        className="flex gap-3 rounded-lg bg-black/20 px-3 py-2"
                      >
                        <span className="border-apex-border flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                          <Icon className="text-apex-cyan h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200">
                            {workout.day} · {disciplineLabel(workout.discipline)}
                            {workout.durationMin !== undefined &&
                              ` · ${workout.durationMin} min`}
                          </p>
                          <p className="text-sm text-slate-500">
                            {workout.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivePlanView({
  event,
  plan,
  userHeightIn,
}: {
  event: {
    _id: string;
    name: string;
    eventDate: string;
    eventType: string;
  };
  plan: {
    generatedAt: number;
    weeks: Array<{
      weekStartDate: string;
      weekNumber: number;
      phase: string;
      targetHours: number;
      workouts: Array<{
        day: string;
        discipline: string;
        description: string;
        durationMin?: number;
      }>;
      notes?: string;
    }>;
  };
  userHeightIn?: number;
}) {
  const regenerateTrainingPlan = useAction(
    api.trainingPlanGen.regenerateTrainingPlan,
  );
  const endActiveEvent = useMutation(api.trainingPlanStore.endActiveEvent);
  const toast = useToast();

  const [regenerating, setRegenerating] = useState(false);
  const [ending, setEnding] = useState(false);

  const today = todayKey();
  const daysLeft = daysUntilEvent(event.eventDate, today);
  const currentWeek = currentPlanWeek(plan.weeks, today);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerateTrainingPlan({
        heightIn: userHeightIn,
      });
      if (!result.ok) {
        toast({
          tone: "error",
          title: "Regeneration failed",
          body: result.error,
        });
        return;
      }
      toast({
        tone: "success",
        title: "Plan regenerated",
        body: "Updated with your latest fitness data.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Regeneration failed",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleEndEvent() {
    setEnding(true);
    try {
      await endActiveEvent({});
      toast({
        tone: "success",
        title: "Event ended",
        body: "You can set a new target race anytime.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not end event",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Your target event">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xl font-bold text-slate-100">{event.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {formatLongDate(event.eventDate)}
            </p>
            <p className="text-apex-cyan mt-3 text-2xl font-bold">
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} until race`
                : daysLeft === 0
                  ? "Race day!"
                  : "Event date passed"}
            </p>
            {currentWeek !== null && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-slate-400">Current phase:</span>
                <PlanPhaseBadge phase={currentWeek.phase} highlighted />
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || ending}
              className="border-apex-border hover:border-apex-cyan/60 flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm text-slate-200 transition-colors disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate plan
            </button>
            <button
              type="button"
              onClick={handleEndEvent}
              disabled={regenerating || ending}
              className="text-sm text-slate-500 hover:text-slate-300 disabled:opacity-60"
            >
              {ending ? "Ending…" : "End this event"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          Generated {new Date(plan.generatedAt).toLocaleString()}
        </p>
      </SectionCard>

      <SectionCard title="Week-by-week plan">
        <WeekAccordion
          weeks={plan.weeks}
          currentWeekNumber={currentWeek?.weekNumber ?? null}
        />
      </SectionCard>
    </div>
  );
}

function PendingPlanView({
  eventName,
  userHeightIn,
}: {
  eventName: string;
  userHeightIn?: number;
}) {
  const regenerateTrainingPlan = useAction(
    api.trainingPlanGen.regenerateTrainingPlan,
  );
  const endActiveEvent = useMutation(api.trainingPlanStore.endActiveEvent);
  const toast = useToast();
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerateTrainingPlan({ heightIn: userHeightIn });
      if (!result.ok) {
        toast({
          tone: "error",
          title: "Plan generation failed",
          body: result.error,
        });
        return;
      }
      toast({
        tone: "success",
        title: "Training plan generated",
        body: "Your periodized plan is ready to review.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Plan generation failed",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <EmptyStateBanner
        message={`${eventName} is active but no plan was saved yet.`}
      />
      <SectionCard title="Generate plan">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="bg-apex-cyan hover:bg-apex-cyan/90 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0a0e1a] transition-colors disabled:opacity-60"
        >
          {regenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating plan…
            </>
          ) : (
            <>
              <Target className="h-4 w-4" />
              Generate training plan
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => endActiveEvent({})}
          className="mt-3 w-full text-sm text-slate-500 hover:text-slate-300"
        >
          End this event
        </button>
      </SectionCard>
    </div>
  );
}

export default function TrainingPlanPage() {
  const user = useQuery(api.users.currentUser);
  const activeEvent = useQuery(api.trainingPlanStore.getActiveEvent);
  const activePlan = useQuery(api.trainingPlanStore.getActivePlan);

  const loading = activeEvent === undefined || activePlan === undefined;
  const hasEvent = activeEvent !== null;
  const hasPlan = activePlan !== null;

  return (
    <>
      <PageHeader
        title="Training Plan"
        subtitle={`Periodized plan working backward from your target event · ${formatLongDate(todayKey())}`}
        action={
          <Link
            href="/dashboard/training"
            className="border-apex-border hover:border-apex-cyan/60 rounded-xl border px-3 py-2 text-sm text-slate-300 transition-colors"
          >
            ← Training performance
          </Link>
        }
      />

      {loading ? (
        <div className="border-apex-border bg-apex-card flex items-center justify-center gap-2 rounded-2xl border p-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : !hasEvent ? (
        <PlanEventForm initialHeightIn={user?.heightIn} />
      ) : !hasPlan ? (
        <PendingPlanView
          eventName={activeEvent.name}
          userHeightIn={user?.heightIn}
        />
      ) : (
        <ActivePlanView
          event={activeEvent}
          plan={activePlan}
          userHeightIn={user?.heightIn}
        />
      )}

      {!loading && !hasEvent && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <Calendar className="h-3.5 w-3.5" />
          Plans need 4–52 weeks until race day. Generation uses Ollama and may
          take a minute.
        </p>
      )}
    </>
  );
}
