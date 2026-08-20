import { describe, expect, test } from "vitest";
import {
  DEFAULT_SETTINGS,
  baseHydrationMl,
  calorieTarget,
  creatineHydrationBonusMl,
  estimatedTdee,
  hydrationTargetMl,
  nutritionTargets,
  proteinTargetG,
  sweatLossMl,
} from "./formulas";

describe("hydration", () => {
  test("base hydration is 30 mL per lb", () => {
    expect(baseHydrationMl(180)).toBe(5400);
    expect(baseHydrationMl(0)).toBe(0);
  });

  test("sweat loss defaults to 0.18 mL per active kcal, rounded", () => {
    expect(sweatLossMl(840)).toBe(151);
    expect(sweatLossMl(0)).toBe(0);
  });

  test("sweat multiplier is tunable", () => {
    expect(sweatLossMl(1000, 0.25)).toBe(250);
  });

  test("creatine bonus is zero when not supplementing", () => {
    expect(creatineHydrationBonusMl(false)).toBe(0);
    expect(creatineHydrationBonusMl(true)).toBe(750);
  });

  test("hydration target is base plus sweat loss", () => {
    expect(hydrationTargetMl(180, 840)).toBe(5400 + 151);
  });

  test("hydration target adds creatine bonus when supplementing", () => {
    expect(hydrationTargetMl(140, 840, { takingCreatine: true })).toBe(
      4200 + 151 + 750,
    );
  });

  test("a rest day target equals the base target", () => {
    expect(hydrationTargetMl(180, 0)).toBe(baseHydrationMl(180));
  });
});

describe("lean bulk nutrition", () => {
  test("TDEE defaults to 15 kcal per lb", () => {
    expect(estimatedTdee(180)).toBe(2700);
  });

  test("activity multiplier is tunable", () => {
    expect(estimatedTdee(180, 17)).toBe(3060);
  });

  test("calorie target is TDEE plus the surplus", () => {
    expect(calorieTarget(180)).toBe(2700 + 400);
    expect(calorieTarget(180, 300)).toBe(3000);
    expect(calorieTarget(180, 400, 17)).toBe(3460);
  });

  test("protein target defaults to 1g per lb", () => {
    expect(proteinTargetG(180)).toBe(180);
    expect(proteinTargetG(180, 1.2)).toBe(216);
  });

  test("fractional weights round to whole grams", () => {
    expect(proteinTargetG(177.4)).toBe(177);
  });
});

describe("nutritionTargets", () => {
  test("bundles every derived target from weight and active calories", () => {
    expect(nutritionTargets(180, 840, DEFAULT_SETTINGS)).toEqual({
      weightLbsAtLog: 180,
      baseHydrationMl: 5400,
      sweatLossMl: 151,
      creatineBonusMl: 0,
      hydrationTargetMl: 5551,
      calorieTarget: 3100,
      proteinTargetG: 180,
    });
  });

  test("creatine bonus is included when supplementing", () => {
    expect(nutritionTargets(140, 840, DEFAULT_SETTINGS, true)).toEqual({
      weightLbsAtLog: 140,
      baseHydrationMl: 4200,
      sweatLossMl: 151,
      creatineBonusMl: 750,
      hydrationTargetMl: 5101,
      calorieTarget: 2500,
      proteinTargetG: 140,
    });
  });

  test("hydration target always equals base plus sweat plus creatine", () => {
    const result = nutritionTargets(203.5, 1240, DEFAULT_SETTINGS, true);
    expect(result.hydrationTargetMl).toBe(
      result.baseHydrationMl + result.sweatLossMl + result.creatineBonusMl,
    );
  });

  test("custom settings flow through every target", () => {
    expect(
      nutritionTargets(200, 1000, {
        sweatMultiplier: 0.25,
        activityMultiplier: 17,
        calorieSurplus: 300,
        proteinGramsPerLb: 1.2,
        creatineBonusMl: 500,
      }, true),
    ).toEqual({
      weightLbsAtLog: 200,
      baseHydrationMl: 6000,
      sweatLossMl: 250,
      creatineBonusMl: 500,
      hydrationTargetMl: 6750,
      calorieTarget: 3700,
      proteinTargetG: 240,
    });
  });
});
