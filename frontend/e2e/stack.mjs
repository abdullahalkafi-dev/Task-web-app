// Starts a throwaway full stack for Playwright: in-memory MongoDB + backend (:4000) + built Next app (:3100).
// Requires `npm run build` in frontend (with BACKEND_URL=http://localhost:4000) and `npm run build` in backend first.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, "..");
const backendDir = path.resolve(here, "../../backend");
const require = createRequire(path.join(backendDir, "package.json"));
const { MongoMemoryServer } = require("mongodb-memory-server");

const mongod = await MongoMemoryServer.create();
const children = [];

const backendEnv = {
  ...process.env,
  NODE_ENV: "test",
  PORT: "4000",
  MONGO_URI: mongod.getUri("dayflow"),
  JWT_SECRET: "e2e_secret_value_123",
  GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
  SUPERADMIN_EMAILS: "admin@e2e.test",
  UPLOAD_DIR: path.join(os.tmpdir(), `dayflow-e2e-${Date.now()}`),
  COOKIE_SECURE: "false",
  TZ: "Asia/Dhaka",
};

children.push(spawn(process.execPath, ["--import", pathToFileURL(path.join(here, "stub-google.mjs")).href, "dist/server.js"], { cwd: backendDir, env: backendEnv, stdio: "inherit" }));
const nextBin = path.join(frontendDir, "node_modules", "next", "dist", "bin", "next");
children.push(
  spawn(process.execPath, [nextBin, "start", "-p", "3100"], {
    cwd: frontendDir,
    env: { ...process.env, TZ: "Asia/Dhaka" },
    stdio: "inherit",
  }),
);

async function shutdown() {
  for (const c of children) c.kill();
  await mongod.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
children.forEach((c) => c.on("exit", shutdown));
