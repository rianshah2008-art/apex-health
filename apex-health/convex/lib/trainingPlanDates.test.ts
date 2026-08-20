import { describe, expect, it } from "vitest";
import {
  attachWeekStartDates,
  mondayOfWeek,
  weeksUntilEvent,
} from "./trainingPlanDates";

describe("trainingPlanDates", () => {
  it("finds Monday of the week containing a date", () => {
    expect(mondayOfWeek("2026-03-15")).toBe("2026-03-09");
  });

  it("counts weeks until an event", () => {
    expect(weeksUntilEvent("2026-12-01", "2026-08-19")).toBe(15);
  });

  it("assigns week start dates backward from race week", () => {
    const starts = attachWeekStartDates("2026-03-15", [
      { weekNumber: 1 },
      { weekNumber: 2 },
      { weekNumber: 3 },
    ]);
    expect(starts).toEqual(["2026-02-23", "2026-03-02", "2026-03-09"]);
  });
});
