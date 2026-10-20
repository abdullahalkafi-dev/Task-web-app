import { app } from "./app";
import { connectDb } from "./config/db";
import { config } from "./config/env";
import { purgeOldTombstones } from "./modules/sync/sync.service";

async function main(): Promise<void> {
  await connectDb();

  const purge = (): void => {
    purgeOldTombstones()
      .then((n) => {
        if (n > 0) console.log(`[purge] removed ${n} old tombstones`);
      })
      .catch((e: unknown) => console.error("[purge] failed", e));
  };
  purge();
  setInterval(purge, 24 * 60 * 60 * 1000).unref();

  app.listen(config.PORT, () => console.log(`[api] listening on :${config.PORT}`));
}

main().catch((err: unknown) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
