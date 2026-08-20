import { parseDateKey, todayKey } from "./dates";

export type EventType =
  | "ironman"
  | "half_ironman"
  | "marathon"
  | "half_marathon"
  | "olympic_triathlon"
  | "sprint_triathlon"
  | "custom";

export const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: "ironman", label: "Ironman" },
  { value: "half_ironman", label: "Half Ironman" },
  { value: "marathon", label: "Marathon" },
  { value: "half_marathon", label: "Half marathon" },
  { value: "olympic_triathlon", label: "Olympic triathlon" },
  { value: "sprint_triathlon", label: "Sprint triathlon" },
  { value: "custom", label: "Custom" },
];

export type PlanWeek = {
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
};

export function daysUntilEvent(
  eventDate: string,
  fromDate: string = todayKey(),
): number {
  const end = parseDateKey(eventDate);
  const start = parseDateKey(fromDate);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

export function currentPlanWeek(
  weeks: PlanWeek[],
  fromDate: string = todayKey(),
): PlanWeek | null {
  if (weeks.length === 0) {
    return null;
  }
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  let current = sorted[0];
  for (const week of sorted) {
    if (fromDate >= week.weekStartDate) {
      current = week;
    }
  }
  return current;
}

export function defaultEventDateKey(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 6);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DISCIPLINE_LABELS: Record<string, string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  strength: "Strength",
  rest: "Rest",
  brick: "Brick",
};

export function disciplineLabel(discipline: string): string {
  return DISCIPLINE_LABELS[discipline] ?? discipline;
}
