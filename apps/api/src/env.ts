import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(candidate)) loadEnvFile(candidate);
}

if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.length ?? 0) < 32) {
  throw new Error("生产环境 SESSION_SECRET 必须至少包含 32 个字符");
}
