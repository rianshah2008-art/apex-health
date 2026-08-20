/**
 * Pure hydration and lean-bulk nutrition math. No Convex imports here so these
 * stay trivially unit-testable and safe to reuse on the client.
 *
 * Every coefficient is a parameter with the spec's default, and callers pass the
 * user's `settings` row so the numbers can be tuned without a code change.
 */

export const DEFAULT_SETTINGS = {
  /** mL of water per active kcal burned. Roughly moderate-intensity sweat rate. */
  sweatMultiplier: 0.18,
  /** kcal per lb of bodyweight. 14 = lighter days, 16-17 = high training volume. */
  activityMultiplier: 15,
  /** kcal above TDEE. 300-500 is the standard lean-bulk range. */
  calorieSurplus: 400,
  proteinGramsPerLb: 1,
  /** Extra daily water while supplementing with creatine (+750 mL default). */
  creatineBonusMl: 750,
  stepGoal: 10_000,
} as const;

export function baseHydrationMl(weightLbs: number): number {
  return Math.round(weightLbs * 30);
}

export function sweatLossMl(
  activeCaloriesBurned: number,
  sweatMultiplier: number = DEFAULT_SETTINGS.sweatMultiplier,
): number {
  return Math.round(activeCaloriesBurned * sweatMultiplier);
}

export function creatineHydrationBonusMl(
  takingCreatine: boolean,
  bonusMl: number = DEFAULT_SETTINGS.creatineBonusMl,
): number {
  return takingCreatine ? bonusMl : 0;
}

export function hydrationTargetMl(
  weightLbs: number,
  activeCaloriesBurned: number,
  options: {
    sweatMultiplier?: number;
    takingCreatine?: boolean;
    creatineBonusMl?: number;
  } = {},
): number {
  const sweatMultiplier =
    options.sweatMultiplier ?? DEFAULT_SETTINGS.sweatMultiplier;
  const creatineBonus =
    options.creatineBonusMl ?? DEFAULT_SETTINGS.creatineBonusMl;
  return (
    baseHydrationMl(weightLbs) +
    sweatLossMl(activeCaloriesBurned, sweatMultiplier) +
    creatineHydrationBonusMl(options.takingCreatine ?? false, creatineBonus)
  );
}

export function estimatedTdee(
  weightLbs: number,
  activityMultiplier: number = DEFAULT_SETTINGS.activityMultiplier,
): number {
  return Math.round(weightLbs * activityMultiplier);
}

export function calorieTarget(
  weightLbs: number,
  surplus: number = DEFAULT_SETTINGS.calorieSurplus,
  activityMultiplier: number = DEFAULT_SETTINGS.activityMultiplier,
): number {
  return estimatedTdee(weightLbs, activityMultiplier) + surplus;
}

export function proteinTargetG(
  weightLbs: number,
  gramsPerLb: number = DEFAULT_SETTINGS.proteinGramsPerLb,
): number {
  return Math.round(weightLbs * gramsPerLb);
}

/**
 * Every target on a `nutritionLog` row, derived from the two inputs that change
 * (weight, active calories) plus the user's tunables. Both the weight logger and
 * the Garmin sync recompute through this so the row can never hold a stale mix.
 */
export function nutritionTargets(
  weightLbs: number,
  activeCaloriesBurned: number,
  settings: {
    sweatMultiplier: number;
    activityMultiplier: number;
    calorieSurplus: number;
    proteinGramsPerLb: number;
    creatineBonusMl: number;
  },
  takingCreatine: boolean = false,
) {
  const base = baseHydrationMl(weightLbs);
  const sweat = sweatLossMl(activeCaloriesBurned, settings.sweatMultiplier);
  const creatine = creatineHydrationBonusMl(
    takingCreatine,
    settings.creatineBonusMl,
  );
  return {
    weightLbsAtLog: weightLbs,
    baseHydrationMl: base,
    sweatLossMl: sweat,
    creatineBonusMl: creatine,
    hydrationTargetMl: base + sweat + creatine,
    calorieTarget: calorieTarget(
      weightLbs,
      settings.calorieSurplus,
      settings.activityMultiplier,
    ),
    proteinTargetG: proteinTargetG(weightLbs, settings.proteinGramsPerLb),
  };
}
