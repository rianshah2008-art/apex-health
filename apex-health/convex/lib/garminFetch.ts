"use node";

/**
 * Garmin Connect data collection.
 *
 * Garmin has no public API for individual developers, so this drives the same
 * private endpoints the Garmin Connect mobile app uses via the `garmin-connect`
 * package. That means it can break without warning whenever Garmin changes
 * something, which shapes two decisions here:
 *
 *   1. Every metric is fetched in its own `collect()` call. One dead endpoint
 *      degrades a single card instead of failing the whole sync.
 *   2. Nothing is trusted to have a particular shape — see `garminValues.ts`.
 *
 * This module must only be imported from a `"use node"` file.
 */
import { GarminConnect } from "garmin-connect";
import {
  at,
  bucketIntraday,
  firstNum,
  firstStr,
  list,
  num,
  parseSampleSeries,
  record,
  secondsToMinutes,
  str,
} from "./garminValues";
import { parseDateKey, shiftDateKey, toDateKey } from "./dateKeys";

const METERS_PER_MILE = 1609.344;
const API = "https://connectapi.garmin.com";

/** 12 two-hour buckets across the day, matching the Body Battery bar. */
const BODY_BATTERY_BUCKETS = 12;
/** 24 hourly buckets for the resting-HR sparkline. */
const HR_TREND_BUCKETS = 24;

export type GarminActivity = {
  type: "run" | "bike" | "swim";
  date: string;
  durationSec: number;
  distanceMeters: number;
  avgPaceSec?: number;
  avgHr?: number;
  calories?: number;
  garminActivityId: string;
};

export type GarminSnapshot = {
  date: string;
  vitals: {
    steps?: number;
    stepGoal?: number;
    restingHeartRate?: number;
    hrTrend?: number[];
    activeCalories?: number;
    totalCalories?: number;
    pulseOxOvernight?: number;
    respirationRate?: number;
    stressLevelAvg?: number;
  };
  recovery: {
    trainingReadiness?: number;
    trainingStatus?: string;
    bodyBatteryTimeline?: number[];
    bodyBatteryCurrent?: number;
    hrvStatus?: string;
    hrvMsAvg?: number;
    sleepScore?: number;
    sleepDurationMin?: number;
    sleepDeepMin?: number;
    sleepRemMin?: number;
    sleepLightMin?: number;
    recoveryTimeHours?: number;
    acuteLoad?: number;
    chronicLoad?: number;
    loadRatio?: number;
  };
  performance: {
    lactateThresholdHr?: number;
    lactateThresholdPaceSec?: number;
    cyclingFtp?: number;
    heatAcclimationPct?: number;
    altitudeAcclimationM?: number;
    runningMileTimeSec?: number;
    bikingMileTimeSec?: number;
    swimming100mPaceSec?: number;
  };
  activities: GarminActivity[];
  /** Human-readable note per endpoint that failed, surfaced in the sync status. */
  warnings: string[];
};

export type GarminSession = { oauth1: unknown; oauth2: unknown };

export type GarminLoginResult = {
  client: GarminConnect;
  session: GarminSession;
  /** True when the cached session was reused rather than a fresh password login. */
  reusedSession: boolean;
};

/**
 * Prefers the cached OAuth tokens and only falls back to a password login when
 * they no longer work, which keeps Garmin from seeing a login on every sync.
 */
export async function loginToGarmin(
  username: string,
  password: string,
  cachedSession: GarminSession | null,
): Promise<GarminLoginResult> {
  const client = new GarminConnect({ username, password });

  if (cachedSession !== null) {
    try {
      client.loadToken(
        cachedSession.oauth1 as never,
        cachedSession.oauth2 as never,
      );
      await client.getUserProfile();
      return {
        client,
        session: cachedSession,
        reusedSession: true,
      };
    } catch {
      // Tokens expired or were rejected; fall through to a full login.
    }
  }

  await client.login();
  return {
    client,
    session: client.exportToken() as unknown as GarminSession,
    reusedSession: false,
  };
}

async function collect<T>(
  warnings: string[],
  label: string,
  fetcher: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fetcher();
  } catch (error) {
    warnings.push(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

function mileTimeSec(durationSec: number, distanceMeters: number): number | undefined {
  if (distanceMeters <= 0 || durationSec <= 0) {
    return undefined;
  }
  return Math.round(durationSec / (distanceMeters / METERS_PER_MILE));
}

function per100mSec(durationSec: number, distanceMeters: number): number | undefined {
  if (distanceMeters <= 0 || durationSec <= 0) {
    return undefined;
  }
  return Math.round(durationSec / (distanceMeters / 100));
}

function classifyActivity(typeKey: string): "run" | "bike" | "swim" | null {
  const key = typeKey.toLowerCase();
  if (key.includes("run")) return "run";
  if (key.includes("cycling") || key.includes("biking")) return "bike";
  if (key.includes("swim")) return "swim";
  return null;
}

/**
 * Biometric range endpoints return one row per measurement date, each tagged
 * with a `series` ("running" / "cycling") — the same endpoint reports a running
 * and a cycling number, so the series filter is what keeps running threshold
 * power out of the Cycling FTP card.
 *
 * Thresholds only re-measure every few weeks, so take the most recent row.
 */
function latestBiometricValue(
  payload: unknown,
  series?: string,
): number | undefined {
  const rows = list(payload) ?? list(at(payload, "values"));
  if (rows === undefined) {
    return undefined;
  }
  let best: { date: string; value: number } | undefined;
  for (const row of rows) {
    if (series !== undefined && firstStr(row, "series") !== series) {
      continue;
    }
    const value = firstNum(row, "value", "unitValue");
    const date = firstStr(row, "until", "from", "updatedDate", "calendarDate");
    if (value === undefined || date === undefined) {
      continue;
    }
    if (best === undefined || date > best.date) {
      best = { date, value };
    }
  }
  return best?.value;
}

export async function fetchGarminSnapshot(
  client: GarminConnect,
  date: string,
): Promise<GarminSnapshot> {
  const warnings: string[] = [];
  const dayStartMs = parseDateKey(date).getTime();
  const rangeStart = shiftDateKey(date, -120);

  const displayName = await collect(warnings, "user profile", async () => {
    const profile = await client.getUserProfile();
    return str((profile as unknown as Record<string, unknown>).displayName);
  });

  const summary = displayName
    ? await collect(warnings, "daily summary", () =>
        client.get<unknown>(
          `${API}/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`,
        ),
      )
    : undefined;

  const heartRate = await collect(warnings, "heart rate", () =>
    client.getHeartRate(parseDateKey(date)),
  );

  const sleep = await collect(warnings, "sleep", () =>
    client.getSleepData(parseDateKey(date)),
  );

  const spo2 = await collect(warnings, "pulse ox", () =>
    client.get<unknown>(`${API}/wellness-service/wellness/daily/spo2/${date}`),
  );

  const bodyBattery = await collect(warnings, "body battery", () =>
    client.get<unknown>(
      `${API}/wellness-service/wellness/bodyBattery/reports/daily?startDate=${date}&endDate=${date}`,
    ),
  );

  const hrv = await collect(warnings, "HRV", () =>
    client.get<unknown>(`${API}/hrv-service/hrv/${date}`),
  );

  const readiness = await collect(warnings, "training readiness", () =>
    client.get<unknown>(
      `${API}/metrics-service/metrics/trainingreadiness/${date}`,
    ),
  );

  const trainingStatus = await collect(warnings, "training status", () =>
    client.get<unknown>(
      `${API}/metrics-service/metrics/trainingstatus/aggregated/${date}`,
    ),
  );

  const maxMetrics = await collect(warnings, "acclimation", () =>
    client.get<unknown>(
      `${API}/metrics-service/metrics/maxmet/daily/${date}/${date}`,
    ),
  );

  const lactateHr = await collect(warnings, "lactate threshold HR", () =>
    client.get<unknown>(
      `${API}/biometric-service/stats/lactateThresholdHeartRate/range/${rangeStart}/${date}?aggregation=daily`,
    ),
  );

  const ftp = await collect(warnings, "cycling FTP", () =>
    client.get<unknown>(
      `${API}/biometric-service/stats/functionalThresholdPower/range/${rangeStart}/${date}?aggregation=daily`,
    ),
  );

  const rawActivities =
    (await collect(warnings, "activities", () => client.getActivities(0, 30))) ??
    [];

  // ---- Daily Vitals -------------------------------------------------------

  const hrSamples = parseSampleSeries(at(heartRate, "heartRateValues"));

  const vitals: GarminSnapshot["vitals"] = {
    steps: firstNum(summary, "totalSteps"),
    stepGoal: firstNum(summary, "dailyStepGoal"),
    restingHeartRate:
      firstNum(summary, "restingHeartRate") ??
      firstNum(heartRate, "restingHeartRate"),
    hrTrend: bucketIntraday(hrSamples, dayStartMs, HR_TREND_BUCKETS),
    activeCalories: firstNum(summary, "activeKilocalories"),
    totalCalories: firstNum(summary, "totalKilocalories"),
    pulseOxOvernight:
      firstNum(spo2, "averageSpO2", "averageSpo2") ??
      firstNum(summary, "averageSpo2", "averageSpO2"),
    respirationRate: firstNum(
      summary,
      "avgWakingRespirationValue",
      "avgSleepRespirationValue",
    ),
    stressLevelAvg: firstNum(summary, "averageStressLevel"),
  };

  // ---- Recovery & Readiness ----------------------------------------------

  const batterySamples = parseSampleSeries(
    at(bodyBattery, 0, "bodyBatteryValuesArray"),
  );
  const sleepDto = record(at(sleep, "dailySleepDTO"));
  const readinessEntry = record(at(readiness, 0)) ?? record(readiness);

  // Training status is keyed by watch device id, so there is no fixed path to
  // it — take the entry flagged as the primary training device, else the first.
  const statusDataMap = record(
    at(trainingStatus, "mostRecentTrainingStatus", "latestTrainingStatusData"),
  );
  const statusEntries = Object.values(statusDataMap ?? {}).flatMap((entry) => {
    const asRecord = record(entry);
    return asRecord === undefined ? [] : [asRecord];
  });
  const statusEntry =
    statusEntries.find((entry) => entry.primaryTrainingDevice === true) ??
    statusEntries[0];
  const acuteLoadDto = record(at(statusEntry, "acuteTrainingLoadDTO"));

  const recoveryTimeMinutes = firstNum(readinessEntry, "recoveryTime");
  const acwrPercent = firstNum(acuteLoadDto, "acwrPercent");

  const recovery: GarminSnapshot["recovery"] = {
    trainingReadiness: firstNum(readinessEntry, "score"),
    trainingStatus: humanizeStatus(
      firstStr(statusEntry, "trainingStatusFeedbackPhrase"),
    ),
    bodyBatteryTimeline: bucketIntraday(
      batterySamples,
      dayStartMs,
      BODY_BATTERY_BUCKETS,
    ),
    bodyBatteryCurrent:
      firstNum(summary, "bodyBatteryMostRecentValue") ??
      lastReading(batterySamples),
    hrvStatus: humanizeStatus(firstStr(at(hrv, "hrvSummary"), "status")),
    hrvMsAvg: firstNum(at(hrv, "hrvSummary"), "lastNightAvg", "weeklyAvg"),
    sleepScore: num(at(sleepDto, "sleepScores", "overall", "value")),
    sleepDurationMin: secondsToMinutes(firstNum(sleepDto, "sleepTimeSeconds")),
    sleepDeepMin: secondsToMinutes(firstNum(sleepDto, "deepSleepSeconds")),
    sleepRemMin: secondsToMinutes(firstNum(sleepDto, "remSleepSeconds")),
    sleepLightMin: secondsToMinutes(firstNum(sleepDto, "lightSleepSeconds")),
    recoveryTimeHours:
      recoveryTimeMinutes === undefined
        ? undefined
        : Math.round(recoveryTimeMinutes / 60),
    acuteLoad: firstNum(acuteLoadDto, "dailyTrainingLoadAcute"),
    chronicLoad: firstNum(acuteLoadDto, "dailyTrainingLoadChronic"),
    // Garmin often leaves the ratio null while still reporting it as a percent.
    loadRatio:
      firstNum(acuteLoadDto, "dailyAcuteChronicWorkloadRatio") ??
      (acwrPercent === undefined
        ? undefined
        : Math.round(acwrPercent) / 100),
  };

  // ---- Training Performance ----------------------------------------------

  const acclimation = record(at(maxMetrics, 0, "heatAltitudeAcclimation"));

  const performance: GarminSnapshot["performance"] = {
    lactateThresholdHr: latestBiometricValue(lactateHr, "running"),
    // `lactateThresholdPaceSec` is intentionally not synced. Garmin's
    // `lactateThresholdSpeed` endpoint returns values (~0.42) whose unit does
    // not match the documented m/s — converting it either way produces a pace
    // that is plausible but unverifiable, so this one card is manual-entry only
    // rather than showing a confidently wrong number.
    cyclingFtp: latestBiometricValue(ftp, "cycling"),
    heatAcclimationPct: firstNum(acclimation, "heatAcclimationPercentage"),
    altitudeAcclimationM: firstNum(
      acclimation,
      "altitudeAcclimation",
      "currentAltitude",
    ),
  };

  // ---- Activities ---------------------------------------------------------

  const activities: GarminActivity[] = [];
  for (const raw of rawActivities) {
    const typeKey = str(at(raw, "activityType", "typeKey"));
    if (typeKey === undefined) {
      continue;
    }
    const type = classifyActivity(typeKey);
    if (type === null) {
      continue;
    }
    const durationSec = Math.round(num(at(raw, "duration")) ?? 0);
    const distanceMeters = num(at(raw, "distance")) ?? 0;
    const startLocal = str(at(raw, "startTimeLocal"));
    const activityId = num(at(raw, "activityId"));
    if (durationSec <= 0 || startLocal === undefined || activityId === undefined) {
      continue;
    }
    activities.push({
      type,
      date: startLocal.slice(0, 10),
      durationSec,
      distanceMeters,
      avgPaceSec:
        type === "swim"
          ? per100mSec(durationSec, distanceMeters)
          : mileTimeSec(durationSec, distanceMeters),
      avgHr: firstNum(raw, "averageHR"),
      calories: firstNum(raw, "calories"),
      garminActivityId: String(activityId),
    });
  }

  // Section 7's pace cards show the most recent effort of each type.
  performance.runningMileTimeSec = mostRecentPace(activities, "run");
  performance.bikingMileTimeSec = mostRecentPace(activities, "bike");
  performance.swimming100mPaceSec = mostRecentPace(activities, "swim");

  return { date, vitals, recovery, performance, activities, warnings };
}

function lastReading(samples: Array<[number, number | null]>): number | undefined {
  for (let index = samples.length - 1; index >= 0; index--) {
    const value = samples[index][1];
    if (value !== null) {
      return value;
    }
  }
  return undefined;
}

function mostRecentPace(
  activities: GarminActivity[],
  type: GarminActivity["type"],
): number | undefined {
  const matching = activities
    .filter((activity) => activity.type === type && activity.avgPaceSec !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date));
  return matching[0]?.avgPaceSec;
}

/**
 * Garmin returns statuses as `MAINTAINING_2` or `UNBALANCED`; the cards want
 * "Maintaining" / "Unbalanced". `NONE` means the watch has not collected enough
 * data yet, which is absence rather than a status worth displaying.
 */
function humanizeStatus(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const base = raw.replace(/_\d+$/, "").replace(/_/g, " ").trim();
  if (base.length === 0 || /^(none|unknown)$/i.test(base)) {
    return undefined;
  }
  return base
    .toLowerCase()
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export { toDateKey };
