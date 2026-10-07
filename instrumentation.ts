export async function register() {
  // Only run in Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Local runs against a copy of prod data must not act on the real world: queued emails,
    // Snipe asset check-ins and the nightly sweeps all run from here. Nothing is lost by
    // skipping: jobs still queue in the database, they just never execute.
    if (process.env.HRT_DISABLE_JOBS === "true") {
      console.warn("[Jobs] HRT_DISABLE_JOBS=true: background jobs and the scheduler are NOT running");
      return;
    }
    const { start } = await import("@/lib/jobs/index");
    await start();
  }
}
