import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Garmin's own sync from watch to cloud is not instant, so polling more often
// than this mostly re-reads the same numbers.
crons.interval(
  "sync garmin data",
  { hours: 2 },
  internal.garmin.syncScheduled,
  {},
);

export default crons;
