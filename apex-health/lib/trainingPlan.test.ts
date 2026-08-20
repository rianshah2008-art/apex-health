import { describe, expect, it } from "vitest";
import { currentPlanWeek, daysUntilEvent } from "./trainingPlan";

describe("trainingPlan helpers", () => {
  it("counts days until an event", () => {
    expect(daysUntilEvent("2026-08-25", "2026-08-19")).toBe(6);
  });

  it("finds the current plan week", () => {
    const weeks = [
      {
        weekStartDate: "2026-08-04",
        weekNumber: 1,
        phase: "base",
        targetHours: 8,
        workouts: [],
      },
      {
        weekStartDate: "2026-08-11",
        weekNumber: 2,
        phase: "build",
        targetHours: 10,
        workouts: [],
      },
      {
        weekStartDate: "2026-08-18",
        weekNumber: 3,
        phase: "peak",
        targetHours: 12,
        workouts: [],
      },
    ];
    expect(currentPlanWeek(weeks, "2026-08-19")?.weekNumber).toBe(3);
    expect(currentPlanWeek(weeks, "2026-08-10")?.weekNumber).toBe(1);
  });
});
