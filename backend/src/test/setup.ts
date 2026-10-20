import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll } from "vitest";

// Must run before any module imports `config/env`.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_value_123";
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.SUPERADMIN_EMAILS = "Boss@Test.dev, other@test.dev";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dayflow-uploads-"));

let mongod: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
