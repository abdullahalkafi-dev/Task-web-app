import mongoose from "mongoose";
import { config } from "./env";

export async function connectDb(uri: string = config.MONGO_URI): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
