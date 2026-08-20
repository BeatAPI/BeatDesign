// Copies the single-user SQLite/D1 schema into the generated working schema.
//
// Env-file loading mirrors scripts/with-env.ts so this script picks up
// DATABASE_PROVIDER from .env.<NODE_ENV> / .env.local / .env when run from
// `pnpm install` postinstall (which doesn't go through with-env.ts).
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

const nodeEnv = process.env.NODE_ENV || "development";
const envFiles = process.env.ENV_FILE
  ? [process.env.ENV_FILE]
  : [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, ".env.local", ".env"];
for (const f of envFiles) loadEnvFile(resolve(f));

const TEMPLATE_BY_PROVIDER = {
  sqlite: "sqlite",
  d1: "sqlite",
};

const provider = (process.env.DATABASE_PROVIDER || "sqlite").toLowerCase();
const templateName = TEMPLATE_BY_PROVIDER[provider];

if (!templateName) {
  console.error(
    `db-setup: unknown DATABASE_PROVIDER=${provider} (supported: ${Object.keys(TEMPLATE_BY_PROVIDER).join(", ")})`,
  );
  process.exit(1);
}

const src = resolve(`src/config/db/schema.${templateName}.ts`);
const dst = resolve("src/config/db/schema.ts");

if (!existsSync(src)) {
  console.error(`db-setup: template not found at ${src}`);
  process.exit(1);
}

copyFileSync(src, dst);
console.log(`db-setup: schema.ts ← schema.${templateName}.ts (DATABASE_PROVIDER=${provider})`);
