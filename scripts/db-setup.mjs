// Copies the single-user local SQLite schema into the generated working schema.
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("src/config/db/schema.sqlite.ts");
const dst = resolve("src/config/db/schema.ts");

if (!existsSync(src)) {
  console.error(`db-setup: template not found at ${src}`);
  process.exit(1);
}

copyFileSync(src, dst);
console.log("db-setup: schema.ts ← schema.sqlite.ts");
