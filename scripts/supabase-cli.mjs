#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env", quiet: true });
loadDotenv({ path: ".env.local", quiet: true });

const BUNDLED_NODE_BIN =
  "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";

const supabaseCli = path.resolve(process.cwd(), "node_modules", ".bin", "supabase");

if (!fs.existsSync(supabaseCli)) {
  console.error("Supabase CLI was not found at node_modules/.bin/supabase.");
  console.error("Run npm install before using this wrapper.");
  process.exit(1);
}

const pathEntries = [BUNDLED_NODE_BIN, process.env.PATH || ""].filter(Boolean);

const result = spawnSync(supabaseCli, process.argv.slice(2), {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PATH: pathEntries.join(path.delimiter),
  },
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
