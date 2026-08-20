/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as garmin from "../garmin.js";
import type * as garminBackfill from "../garminBackfill.js";
import type * as garminStore from "../garminStore.js";
import type * as http from "../http.js";
import type * as lib_dateKeys from "../lib/dateKeys.js";
import type * as lib_formulas from "../lib/formulas.js";
import type * as lib_garminFetch from "../lib/garminFetch.js";
import type * as lib_garminValues from "../lib/garminValues.js";
import type * as lib_records from "../lib/records.js";
import type * as lib_trainingPlanDates from "../lib/trainingPlanDates.js";
import type * as meals from "../meals.js";
import type * as nutrition from "../nutrition.js";
import type * as recovery from "../recovery.js";
import type * as settings from "../settings.js";
import type * as training from "../training.js";
import type * as trainingPlanGen from "../trainingPlanGen.js";
import type * as trainingPlanStore from "../trainingPlanStore.js";
import type * as users from "../users.js";
import type * as vitals from "../vitals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  auth: typeof auth;
  crons: typeof crons;
  garmin: typeof garmin;
  garminBackfill: typeof garminBackfill;
  garminStore: typeof garminStore;
  http: typeof http;
  "lib/dateKeys": typeof lib_dateKeys;
  "lib/formulas": typeof lib_formulas;
  "lib/garminFetch": typeof lib_garminFetch;
  "lib/garminValues": typeof lib_garminValues;
  "lib/records": typeof lib_records;
  "lib/trainingPlanDates": typeof lib_trainingPlanDates;
  meals: typeof meals;
  nutrition: typeof nutrition;
  recovery: typeof recovery;
  settings: typeof settings;
  training: typeof training;
  trainingPlanGen: typeof trainingPlanGen;
  trainingPlanStore: typeof trainingPlanStore;
  users: typeof users;
  vitals: typeof vitals;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
